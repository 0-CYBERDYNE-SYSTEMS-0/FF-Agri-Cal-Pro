// Compact farm context for the assistant. Loads the user's farm profile plus
// fields, crops, equipment, buildings, and staff, and renders them as a few
// dense context lines. Long lists are truncated so the block stays small; when
// no farm profile exists, exactly one line nudges the farmer to configure it.
import type { IStorage } from "./storage";

// At most this many entries per entity list; the rest collapse into "+N more"
const MAX_LISTED = 12;

function formatDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Renders a header plus one line per item, capped at MAX_LISTED with a
// "+N more" marker. An empty list renders nothing at all.
function entityLines<T>(items: T[], header: string, render: (item: T) => string): string[] {
  if (items.length === 0) return [];
  const lines = [header, ...items.slice(0, MAX_LISTED).map(render)];
  if (items.length > MAX_LISTED) {
    lines.push(`+${items.length - MAX_LISTED} more`);
  }
  return lines;
}

// Joins the non-empty parts of a parenthesized detail list: "North 40 (40 acres, clay loam)"
function withDetails(name: string, details: (string | null | undefined)[]): string {
  const present = details.filter((d): d is string => !!d && d.trim().length > 0);
  return present.length > 0 ? `${name} (${present.join(", ")})` : name;
}

export async function buildFarmContextLines(userId: number, storage: IStorage): Promise<string[]> {
  const farm = await storage.getFarmByUser(userId);
  if (!farm) {
    return [
      "Farm profile: not configured. You can still help generally; suggest the farmer set up their farm profile for grounded advice.",
    ];
  }

  const [fields, crops, equipment, buildings, staff] = await Promise.all([
    storage.getFieldsByUser(userId),
    storage.getCropsByUser(userId),
    storage.getEquipmentByUser(userId),
    storage.getBuildingsByUser(userId),
    storage.getStaffByUser(userId),
  ]);

  const lines: string[] = [
    `Farm: ${withDetails(farm.name, [
      farm.locationName,
      farm.growingZone,
      farm.totalAcres != null ? `${farm.totalAcres} acres` : null,
      farm.notes ? `notes: ${farm.notes}` : null,
    ])}`,
  ];

  lines.push(...entityLines(fields, "Fields:", field =>
    withDetails(field.name, [
      field.acres != null ? `${field.acres} acres` : null,
      field.soilType,
      field.currentCrop ? `current crop: ${field.currentCrop}` : null,
    ])));

  lines.push(...entityLines(crops, "Crops:", crop => {
    const name = crop.variety ? `${crop.name} / ${crop.variety}` : crop.name;
    const details = [crop.status];
    const planted = formatDate(crop.plantedAt);
    const harvest = formatDate(crop.expectedHarvestAt);
    if (planted) details.push(`planted ${planted}`);
    if (harvest) details.push(`harvest expected ${harvest}`);
    return withDetails(name, details);
  }));

  lines.push(...entityLines(equipment, "Equipment:", item =>
    withDetails(item.name, [item.category, item.status])));

  lines.push(...entityLines(buildings, "Buildings:", building =>
    withDetails(building.name, [building.category])));

  lines.push(...entityLines(staff, "Staff:", member =>
    withDetails(member.name, [member.role])));

  return lines;
}
