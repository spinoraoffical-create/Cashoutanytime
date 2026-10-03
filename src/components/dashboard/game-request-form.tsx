"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GAMES } from "@/lib/games";
import { createGameRequest } from "@/lib/actions/game-requests";
import { toast } from "sonner";

export function GameRequestForm() {
  const [gameId, setGameId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const selectedGame = GAMES.find((g) => g.id === gameId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGame) return;

    setLoading(true);
    const formData = new FormData();
    formData.set("game_name", selectedGame.name);
    formData.set("game_provider", selectedGame.provider);
    formData.set("notes", notes);

    const result = await createGameRequest(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Game request submitted!");
      setGameId("");
      setNotes("");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Select Game</Label>
        <Select value={gameId} onValueChange={setGameId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a game..." />
          </SelectTrigger>
          <SelectContent>
            {GAMES.map((game) => (
              <SelectItem key={game.id} value={game.id}>
                {game.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special requirements..."
          rows={3}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !gameId}>
        {loading ? "Submitting..." : "Submit Request"}
      </Button>
    </form>
  );
}
