---
name: auto-blog-image-fix
description: Use this skill to orchestrate an autonomous text-to-image creation workflow that prevents gibberish text rendering for slot games like Juwa.
model: gemini-3.5-flash
---

# Skill Workflow: Autonomous Blog Content & Image Matching

## Objective
Your goal is to process automated content requests for gaming platforms (e.g., Juwa 777), separate the abstract themes from the physical constraints of image generators, and deliver polished text coupled with text-free illustrations.

## Rules of Engagement
- **No Text in Graphics**: Under no circumstances should the final prompt or generated image contain alphanumeric text, typos, logos, or typography.
- **Isolate Parameters**: Translate abstract platform brand names into physical objects, textures, and specific color palettes before invoking any rendering engines.

## Prescriptive Execution Steps

### Step 1: Content Extraction & Planning
1. Research the specific game target specified in the request (e.g., Juwa 777, Fire Kirin, Vblink).
2. Generate an engaging, high-quality blog article or Telegram promotional message. 
3. Isolate the key themes (e.g., slots, arcade gaming, jackpot prize features).

### Step 2: Visual Prompt Reconstruction (The Prompt Engineer Fix)
1. Read the newly generated text asset.
2. Translate abstract branding or gaming terms into concrete physical subjects.
   - *Example*: If the topic is "Juwa Slots", translate this to: "A vibrant 3D render of a casino slot machine reel showcasing lucky triple 777 symbols, falling gold coins exploding outward, cinematic dramatic studio lighting, deep neon purple and gold accents, completely clear background."
3. Strict Prompt Output Filter: Ensure the string describes purely spatial assets and contains explicit criteria banning letters or wording.

### Step 3: Artifact Generation & Storage
1. Invoke your backend tools to pass the visual prompt directly to the serverless image model.
2. Save the graphics cleanly as an asset file (`blog_post_image.jpg`) in the workspace.
3. Consolidate the text block and the image file together, verifying they are ready for automated Telegram and publishing webhooks.

### Step 4: Verification Loop
1. Review the final generated artifact. If any text artifacting appears in the output file, re-execute the prompt fixer and regenerate the image block up to 2 times.
