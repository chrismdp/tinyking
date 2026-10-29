export const COLOURS = {
  "mountain": 0x3C3A44,
  "deep water": 0x2F4999,
  "shallow water": 0x3F6FAE,
  "grassland": 0x80C05D,
  "sown": 0x6C4332,
  "growing": 0x6C4332,
  "harvestable": 0xE2C879,
  "dirt": 0x6C4332,
  "field": 0x5A5C46,
  "stone": 0x5D7084,
  "tree": 0x30512F,
  "trunk": 0x4A3226,
  "skin": 0xEACAAA,
  "wall": 0x8A6A4A,
  "roof": 0x6C4332,
  "door": 0x1E1612,
};

export const ITEM_COLOURS = {
  "wood": COLOURS.dirt,
  "grain": COLOURS.harvestable,
  "gruel": 0x7A845C,
  "forage": 0xC45C77
};

export const PLAYER_REALM = 0xD93B30;
export const SELECTED = 0xFFF2A8;

// NOTE: every other realm gets a steady colour of its own, picked from its
// controller's id. None of these are red, which belongs to the player.
const OTHER_REALMS = [ 0x3D7DD9, 0x35B5A6, 0xA45CD6, 0xE0B83A, 0x6E8BA8, 0xEDEDED ];

export const realmColour = (controllerId, playerId) =>
  controllerId == playerId ? PLAYER_REALM : OTHER_REALMS[(+controllerId || 0) % OTHER_REALMS.length];
