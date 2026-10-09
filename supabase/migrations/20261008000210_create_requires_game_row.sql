-- A successful create must write game_accounts. A missing games row fails the request
-- and does not keep a username.

CREATE OR REPLACE FUNCTION public.complete_game_load(
  p_request_id UUID,
  p_success BOOLEAN,
  p_game_username TEXT DEFAULT NULL,
  p_game_password TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_redeemed_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_load_requests;
  v_credit NUMERIC;
  v_dest_wallet TEXT;
  v_game_id UUID;
  v_username TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_row
  FROM public.game_load_requests
  WHERE id = p_request_id
    AND status IN ('pending', 'processing')
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_game_id
  FROM public.games
  WHERE lower(slug) = lower(v_row.game_slug)
  LIMIT 1;

  IF NOT p_success AND v_row.load_type IN ('load', 'reload') THEN
    PERFORM public.refund_game_load_wallet(p_request_id);
  END IF;

  IF p_success AND v_row.load_type IN ('create_account', 'new_account') THEN
    v_username := NULLIF(btrim(COALESCE(p_game_username, v_row.game_username, '')), '');
    IF v_game_id IS NULL OR v_username IS NULL THEN
      UPDATE public.game_load_requests
      SET
        status = 'failed',
        game_username = NULL,
        game_password = NULL,
        error_message = CASE
          WHEN v_game_id IS NULL THEN format('No games row for %s.', v_row.game_slug)
          ELSE 'Provider did not return a username.'
        END,
        updated_at = v_now
      WHERE id = p_request_id;
      RETURN;
    END IF;

    INSERT INTO public.game_accounts (
      user_id, game_id, game_username, game_password, credits_balance, last_synced_at, updated_at
    )
    VALUES (
      v_row.user_id,
      v_game_id,
      v_username,
      COALESCE(p_game_password, v_row.game_password),
      0,
      v_now,
      v_now
    )
    ON CONFLICT (user_id, game_id) DO UPDATE
      SET game_username = EXCLUDED.game_username,
          game_password = COALESCE(EXCLUDED.game_password, game_accounts.game_password),
          updated_at = v_now;
  ELSIF p_success THEN
    IF v_row.load_type IN ('load', 'reload', 'redeem') THEN
      UPDATE public.game_load_requests
      SET game_api_debited = true
      WHERE id = p_request_id;
    END IF;

    IF v_row.load_type IN ('load', 'reload') AND v_game_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.game_accounts ga
        WHERE ga.user_id = v_row.user_id
          AND ga.game_id = v_game_id
          AND lower(ga.game_username) = lower(coalesce(v_row.game_username, ''))
      ) THEN
        RAISE EXCEPTION 'Account not found';
      END IF;
      UPDATE public.game_accounts
      SET credits_balance = credits_balance + COALESCE(v_row.amount, 0),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id AND game_id = v_game_id;

    ELSIF v_row.load_type = 'redeem' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.game_accounts ga
        WHERE ga.user_id = v_row.user_id
          AND (v_game_id IS NULL OR ga.game_id = v_game_id)
          AND lower(ga.game_username) = lower(coalesce(v_row.game_username, ''))
      ) THEN
        RAISE EXCEPTION 'Account not found';
      END IF;

      v_credit := COALESCE(p_redeemed_amount, NULLIF(v_row.amount, 0));
      IF v_credit IS NULL OR v_credit <= 0 THEN
        RAISE EXCEPTION 'Redeem completion requires a positive amount';
      END IF;

      v_dest_wallet := CASE WHEN v_row.wallet_type = 'bonus' THEN 'bonus_redeem' ELSE 'cashout' END;
      PERFORM set_config('app.wallet_update', 'true', true);

      IF v_dest_wallet = 'bonus_redeem' THEN
        UPDATE public.profiles
        SET bonus_redeem_wallet = bonus_redeem_wallet + v_credit
        WHERE id = v_row.user_id;
      ELSE
        UPDATE public.profiles
        SET cashout_wallet = cashout_wallet + v_credit
        WHERE id = v_row.user_id;
      END IF;

      INSERT INTO public.wallet_transactions (
        user_id, amount, wallet_type, transaction_type, source, description, created_by
      )
      VALUES (
        v_row.user_id, v_credit, v_dest_wallet, 'credit', 'game_redeem',
        format('Redeem $%s from %s', v_credit, v_row.game_name), v_row.user_id
      );

      UPDATE public.game_accounts
      SET credits_balance = GREATEST(0, credits_balance - v_credit),
          last_synced_at = v_now,
          updated_at = v_now
      WHERE user_id = v_row.user_id
        AND (v_game_id IS NULL OR game_id = v_game_id)
        AND lower(game_username) = lower(v_row.game_username);

    ELSIF v_row.load_type = 'check_balance' AND p_redeemed_amount IS NOT NULL THEN
      UPDATE public.game_accounts
      SET credits_balance = p_redeemed_amount, last_synced_at = v_now, updated_at = v_now
      WHERE user_id = v_row.user_id
        AND (v_game_id IS NULL OR game_id = v_game_id);
    END IF;
  END IF;

  UPDATE public.game_load_requests
  SET
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    game_username = CASE
      WHEN v_row.load_type IN ('load', 'reload', 'redeem', 'check_balance') THEN game_username
      ELSE COALESCE(p_game_username, game_username)
    END,
    game_password = COALESCE(p_game_password, game_password),
    amount = CASE
      WHEN p_success AND v_row.load_type IN ('redeem', 'check_balance') THEN COALESCE(p_redeemed_amount, amount)
      ELSE amount
    END,
    error_message = p_error_message,
    completed_at = CASE WHEN p_success THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_game_load(UUID, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC) TO service_role;

-- Replace is allowed when the player already has a saved game account, even if the
-- old create request was not marked completed.
CREATE OR REPLACE FUNCTION public.request_game_account_create(
  p_game_slug TEXT,
  p_game_name TEXT,
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_replace BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_username TEXT := NULLIF(trim(p_username), '');
  v_password TEXT := NULLIF(p_password, '');
  v_has_account BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.fail_stale_game_loads(15, v_user_id, p_game_slug);

  IF EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id AND game_slug = p_game_slug
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'A request is already in progress for this game. Cancel it under Recent activity, or wait for the bot.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.game_accounts ga
    WHERE ga.user_id = v_user_id
      AND ga.game_id = public.game_id_for_slug(p_game_slug)
      AND NULLIF(btrim(ga.game_username), '') IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.game_load_requests
    WHERE user_id = v_user_id
      AND game_slug = p_game_slug
      AND status = 'completed'
      AND load_type IN ('create_account', 'new_account')
      AND game_username IS NOT NULL
  ) INTO v_has_account;

  IF v_has_account AND NOT COALESCE(p_replace, FALSE) THEN
    RAISE EXCEPTION 'You already have a game account. Use Replace Account to get new login details.';
  END IF;

  IF NOT v_has_account AND COALESCE(p_replace, FALSE) THEN
    RAISE EXCEPTION 'No account to replace yet. Create your first account instead.';
  END IF;

  IF v_username IS NOT NULL AND v_password IS NULL THEN
    RAISE EXCEPTION 'Password required when choosing a custom username';
  END IF;

  INSERT INTO public.game_load_requests (
    user_id, game_slug, game_name, amount, wallet_type, load_type, game_username, game_password, status, admin_notes
  )
  VALUES (
    v_user_id, p_game_slug, p_game_name, 0, 'current', 'create_account', v_username, v_password, 'pending',
    CASE WHEN COALESCE(p_replace, FALSE) THEN 'account_replace' ELSE NULL END
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_game_account_create(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_game_account_create(TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Catalog titles that are not in admin yet stay off until Active is turned on.
INSERT INTO public.games (slug, name, description, image_url, download_url, is_featured, is_active, popularity, category_id)
SELECT v.slug, v.name, v.description, v.image_url, v.download_url, false, false, v.popularity, c.id
FROM (
  VALUES
    ('orion-stars', 'Orion Stars', 'Constellation fish tables.', '/games/orion-stars.webp', 'https://orionstars.com/', 88, 'fishing'),
    ('panda-master', 'Panda Master', 'Panda fish tables.', '/games/panda-master.webp', 'https://pandamaster.com/', 86, 'fishing'),
    ('milky-way', 'Milky Way', 'Galaxy fish tables.', '/games/milky-way.webp', 'https://milkyway.com/', 84, 'fishing'),
    ('vblink', 'VBlink', 'Fish and slots.', '/games/vblink.webp', 'https://vblink.com/', 83, 'fishing'),
    ('ultrapanda', 'Ultra Panda', 'Fish and slots with the panda mascot.', '/games/ultrapanda.webp', 'https://www.ultrapanda.mobi/', 82, 'fishing'),
    ('river-sweeps', 'River Sweeps', 'Vegas-style slots and tables.', '/games/river-sweeps.webp', 'https://www.riversweeps.com/', 80, 'slots'),
    ('lucky-slots', 'Lucky Slots', 'Classic fruit reels and multipliers.', '/games/lucky-slots.webp', 'https://luckyslots.com/', 78, 'slots'),
    ('high-stakes', 'High Stakes', 'Table games for casino play.', '/games/high-stakes.webp', 'https://highstakes.com/', 76, 'table-games'),
    ('golden-dragon', 'Golden Dragon', 'Dragon fish-hunting boards.', '/games/golden-dragon.webp', 'https://goldendragon.com/', 74, 'fishing'),
    ('blue-dragon', 'Blue Dragon', 'Ocean arcade fish tables.', '/games/blue-dragon.webp', 'https://bluedragon.com/', 72, 'fishing'),
    ('dragon-master', 'Dragon Master', 'High-speed shooter arenas.', '/games/dragon-master.webp', 'https://dragonmaster.com/', 70, 'fishing'),
    ('gameroom', 'Game Room', 'Slots, fish games, and keno.', '/games/gameroom.webp', 'https://www.gameroom777.com/m', 75, 'slots'),
    ('ace-book', 'Ace Book', 'Card tables and book-style games.', '/games/ace-book.webp', 'https://acebook.com/', 68, 'table-games'),
    ('galaxy-games', 'Galaxy Games', 'Space-themed slots.', '/games/galaxy-games.webp', 'https://galaxygames.com/', 66, 'slots'),
    ('moolah', 'Moolah', 'Bonus wheels and slot reels.', '/games/moolah.webp', 'https://moolahslots.com/', 64, 'slots'),
    ('vb-game', 'VB Game', 'Slots and fish tables.', '/games/vb-game.webp', 'https://vbgame.com/', 62, 'slots'),
    ('mega-spin', 'Mega Spin', 'Large-format slots and bonus rounds.', '/games/mega-spin.webp', 'https://megaspin.com/', 60, 'slots'),
    ('lucky-lion', 'Lucky Lion', 'Gold-lion slot reels.', '/games/lucky-lion.webp', 'https://luckylion.com/', 58, 'slots'),
    ('pharaohs-treasure', 'Pharaoh''s Treasure', 'Egyptian slot reels.', '/games/pharaohs-treasure.webp', 'https://pharaohstreasure.com/', 56, 'slots'),
    ('ocean-king', 'Ocean King', 'Underwater fish shooting.', '/games/ocean-king.webp', 'https://oceanking.com/', 54, 'fishing'),
    ('fish-hunter', 'Fish Hunter', 'Cannon shooting fish tables.', '/games/fish-hunter.webp', 'https://fishhunter.com/', 52, 'fishing'),
    ('monster-hunter', 'Monster Hunter', 'Sea-monster fish tables.', '/games/monster-hunter.webp', 'https://monsterhunter.com/', 50, 'fishing'),
    ('buffalo-link', 'Buffalo Link', 'Stampede slot reels.', '/games/buffalo-link.webp', 'https://buffalolink.com/', 48, 'slots')
) AS v(slug, name, description, image_url, download_url, popularity, category_key)
JOIN public.game_categories c ON c.key = v.category_key
WHERE NOT EXISTS (SELECT 1 FROM public.games g WHERE g.slug = v.slug);
