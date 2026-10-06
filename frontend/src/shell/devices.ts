// Каталог пристроїв для демонстрації мобільного застосунку в рамці
export interface Device {
  id: string;
  name: string;
  kind: 'phone' | 'tablet' | 'laptop';
  os: 'ios' | 'android' | 'web';
  w: number; // логічна ширина екрана (CSS-пікселі), портретна орієнтація
  h: number;
  radius: number; // радіус екрана
  bezel: number; // товщина рамки
  notch: 'island' | 'punch' | 'none';
}

export const DEVICES: Device[] = [
  { id: 'iphone15', name: 'iPhone 15 Pro', kind: 'phone', os: 'ios', w: 393, h: 852, radius: 52, bezel: 12, notch: 'island' },
  { id: 'iphonese', name: 'iPhone SE', kind: 'phone', os: 'ios', w: 375, h: 667, radius: 22, bezel: 14, notch: 'none' },
  { id: 'pixel8', name: 'Google Pixel 8', kind: 'phone', os: 'android', w: 412, h: 915, radius: 40, bezel: 10, notch: 'punch' },
  { id: 'galaxy', name: 'Samsung Galaxy S24', kind: 'phone', os: 'android', w: 360, h: 780, radius: 36, bezel: 9, notch: 'punch' },
  { id: 'ipad', name: 'iPad mini', kind: 'tablet', os: 'ios', w: 744, h: 1133, radius: 32, bezel: 16, notch: 'none' },
  { id: 'laptop', name: 'Ноутбук (браузер)', kind: 'laptop', os: 'web', w: 1180, h: 740, radius: 10, bezel: 0, notch: 'none' },
];

export const byId = (id: string | null | undefined) => DEVICES.find((d) => d.id === id) ?? DEVICES[0];
