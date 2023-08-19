# Soundboard Bot

## Introduction

Soundboard Bot is a Discord bot that allows you to upload and then play custom sound clips in the voice channel you are in.

## Features

- Set a dedicated text channel for Soundboard Bot interactions.
- Administrators can upload and label new sound clips.
- Users can play these clips in voice channels with a simple click by reacting to the message.

## Setup

1. [Invite Soundboard Bot to your server](https://discord.com/api/oauth2/authorize?client_id=1142497254725398709&permissions=360813953088&scope=bot).
2. Use the `/setchannel` command followed by the name or mention of the text channel you want to dedicate to Soundboard Bot.
    - Example: `/setchannel channel:#soundboard-bot`
3. Soundboard Bot will then create a thread in the specified channel for sound clip uploads.
    - This thread can also be used for running other soundboard related commands. 

## Adding Sound Clips

1. An admin should navigate to the Soundboard Bot's thread in the dedicated channel.
2. Upload an `.mp3` file as an attachment.
3. Name the sound clip by providing a message text with the attachment. This name will be used to identify the sound clip.
   - Example: If you want to name the sound clip "Laughter", attach the mp3 file and add the message "Laughter".
4. Soundboard Bot will process the uploaded file and then paste a new message in the dedicated channel with an emote for playing it.

## Playing Sound Clips

1. Join a voice channel on the server.
2. Navigate to the dedicated Soundboard Bot channel.
3. Click on the emote associated with the desired soundboard clip.
4. Enjoy the sound clip playback in the voice channel!
