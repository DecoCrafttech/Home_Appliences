export const homeAppliances = [
  {
    key: "air-conditioner",
    label: "Air Conditioner",
    match: /air.condition|\bac\b/i,
  },
  {
    key: "refrigerator",
    label: "Refrigerator",
    match: /refrigerator|fridge|freezer/i,
  },
  {
    key: "washing-machine",
    label: "Washing Machine",
    match: /washing|laundry/i,
  },
  { key: "television", label: "Television", match: /television|\btv\b/i },
  { key: "water-heater", label: "Water Heater", match: /water.heater|geyser/i },
  { key: "microwave", label: "Microwave Oven", match: /microwave/i },
  {
    key: "water-purifier",
    label: "Water Purifier / RO",
    match: /purif|\bro\b/i,
  },
  {
    key: "kitchen-chimney",
    label: "Kitchen Chimney",
    match: /chimney|extractor/i,
  },
  { key: "dishwasher", label: "Dishwasher", match: /dishwash/i },
] as const;

export const isOtherAppliance = (name: string) =>
  /^other(?:[\s-]+appliances?)?$/i.test(name.trim());
const additionalAppliances = [
  { key: "cctv", label: "CCTV", match: /cctv|security.camera/i },
  {
    key: "internet",
    label: "AirFiber and Internet",
    match: /airfiber|internet|router|broadband/i,
  },
];
export function appliancePresentation(name: string) {
  return (
    [...homeAppliances, ...additionalAppliances].find((appliance) =>
      appliance.match.test(name),
    ) ?? { key: "unlisted", label: name, match: /$^/ }
  );
}
export const isMixerGrinder = (name: string) => /mixer|grinder/i.test(name);
export const isHiddenCustomerAppliance = (name: string) =>
  isOtherAppliance(name) || isMixerGrinder(name);
export function appliancePhoto(name: string) {
  if (/home.maintenance/i.test(name)) return "/categories/v8/maintenance.webp";
  const appliance = appliancePresentation(name);
  return appliance.key === "unlisted"
    ? undefined
    : `/appliances/v8/${appliance.key}.webp`;
}
