// Parsing of the public Steam inventory JSON (steamcommunity.com/inventory/<steamid>/730/2).
// A CS2 item is identified by name + wear (float) + pattern: these survive a trade, the asset id does not.

export interface SteamAsset {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
}

export interface SteamDescription {
  appid: number;
  classid: string;
  instanceid: string;
  name?: string;
  market_hash_name: string;
  type?: string;
  tradable: number;
  icon_url?: string;
  name_color?: string;
  descriptions?: { type: string; value: string; name?: string }[];
}

export interface SteamAssetProperty {
  propertyid: number;
  int_value?: string;
  float_value?: string;
  string_value?: string;
  name?: string;
}

export interface SteamAssetProperties {
  appid: number;
  contextid: string;
  assetid: string;
  asset_properties: SteamAssetProperty[];
}

export interface SteamInventory {
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  asset_properties?: SteamAssetProperties[];
  total_inventory_count?: number;
  success?: number;
}

export interface InventoryItem {
  assetid: string;
  name: string;
  /** Wear Rating (float) exactly as Steam reports it; empty for items without wear (stickers, coins). */
  wear: string;
  /** Pattern Template; 0 for items without one. */
  pattern: number;
  tradable: boolean;
  type: string;
  icon: string;
  color: string;
}

export interface ItemSpec {
  name: string;
  wear: string;
  pattern: number;
}

const PATTERN_TEMPLATE = 1;
const WEAR_RATING = 2;

export function parseInventory(inventory: SteamInventory): InventoryItem[] {
  const descriptions = new Map((inventory.descriptions ?? []).map((d) => [`${d.classid}_${d.instanceid}`, d]));
  const properties = new Map((inventory.asset_properties ?? []).map((p) => [p.assetid, p.asset_properties]));
  return (inventory.assets ?? []).map((asset) => {
    const description = descriptions.get(`${asset.classid}_${asset.instanceid}`);
    const props = properties.get(asset.assetid) ?? [];
    const pattern = props.find((p) => p.propertyid === PATTERN_TEMPLATE)?.int_value;
    const wear = props.find((p) => p.propertyid === WEAR_RATING)?.float_value;
    return {
      assetid: asset.assetid,
      name: description?.market_hash_name ?? `classid ${asset.classid}`,
      wear: wear ?? "",
      pattern: pattern ? Number(pattern) : 0,
      tradable: description?.tradable === 1,
      type: description?.type ?? "",
      icon: description?.icon_url ?? "",
      color: description?.name_color ?? "b0c3d9",
    };
  });
}

/** Every item matching name + wear + pattern (never the asset id). A unique skin matches at most once. */
export function matchingItems(items: readonly InventoryItem[], spec: ItemSpec): InventoryItem[] {
  return items.filter((item) => item.name === spec.name && item.wear === spec.wear && item.pattern === spec.pattern);
}
