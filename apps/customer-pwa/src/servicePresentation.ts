import {
  FaBoxOpen,
  FaCalendarCheck,
  FaDisplay,
  FaDroplet,
  FaFire,
  FaGear,
  FaPlug,
  FaScrewdriverWrench,
  FaSnowflake,
  FaWandMagicSparkles,
  FaFaucetDrip,
  FaBolt,
  FaPaintRoller,
} from "react-icons/fa6";

export function serviceIcon(name: string, type: string) {
  if (/plumb|pipe|tap/i.test(name)) return FaFaucetDrip;
  if (/electri|power|earthing/i.test(name)) return FaBolt;
  if (/paint/i.test(name)) return FaPaintRoller;
  if (/uninstall|disconnect|remov/i.test(name)) return FaPlug;
  if (/install|setup|set.up/i.test(name) || type === "INSTALLATION")
    return FaBoxOpen;
  if (/maint|amc|annual/i.test(name)) return FaCalendarCheck;
  if (/filter|cartridge|membrane/i.test(name)) return FaDroplet;
  if (/cool/i.test(name)) return FaSnowflake;
  if (/heating|heat.*repair|geyser.*repair/i.test(name)) return FaFire;
  if (/display|screen|picture/i.test(name)) return FaDisplay;
  if (/clean/i.test(name)) return FaWandMagicSparkles;
  if (/repair|fault|fix/i.test(name)) return FaScrewdriverWrench;
  return FaGear;
}
