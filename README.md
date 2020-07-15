# Ting King

[![Discord](https://img.shields.io/discord/731912590489288795?color=blue&label=discord)](https://discord.gg/ZgXcVyn)

This is an open source kingdom building game, that will live at https://tinyking.io.

You are a tiny King, destined to make a name for yourself and your descendents! You take the role of the leader of a minature kingdom, initially just a few people in simple farmsteads. Your job is to get a bustling economy flowing purely through interacting with and directing your subjects through the seasons. You'll watch them grow, have families, form relationshps, and grow old, giving way to the next generation. Along the way, your character too will pass his mantle on to their descendants.

It's very much focused on the people and relationships as with my previous game [Sol Trader](https://soltrader.net/) - not everyone will be happy about your choices, and you'll have to deal with a number of difficult social situations along the way.

I plan to distribute a paid standalone copy on Steam and Itch.io, but the web version will remain free to use, and people will always be able to build from source.

## Development

Check out [the project pages](https://github.com/chrismdp/tinyking/projects/) for progress.

## Technical details

The game is built using Javascript, with Webpack for linting, transpiling and distribution. The tiny API it needs will be hosted via AWS Amplify.

I plan to use React for UI and PixiJS for rendering.

Persistance will be via browser local storage in the web version.

To get started, download the code, ensure you have `npm` installed, then run `npm install && npm start`. This should load a new browser window with the game running.
