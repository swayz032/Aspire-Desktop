import { ImageSourcePropType } from 'react-native';

const imageMap: Record<string, ImageSourcePropType> = {
  'pallet-yard': require('@/assets/images/founder-hub/pallet-yard.jpg'),
  'warehouse-dock': require('@/assets/images/founder-hub/warehouse-dock.jpg'),
  'pallet-stacks': require('@/assets/images/founder-hub/pallet-stacks.jpg'),
  'lumber-yard': require('@/assets/images/founder-hub/lumber-yard.jpg'),
  'safety-floor': require('@/assets/images/founder-hub/safety-floor.jpg'),
  'truck-loading': require('@/assets/images/founder-hub/truck-loading.jpg'),
  'delivery-truck': require('@/assets/images/founder-hub/delivery-truck.jpg'),
  'template-cover-outreach': require('@/assets/images/founder-hub/template-cover-outreach.jpg'),
  'template-cover-sales': require('@/assets/images/founder-hub/template-cover-sales.jpg'),
  'template-cover-scripts': require('@/assets/images/founder-hub/template-cover-scripts.jpg'),
  'playbook-cover-ops': require('@/assets/images/founder-hub/playbook-cover-ops.jpg'),
  'playbook-cover-logistics': require('@/assets/images/founder-hub/playbook-cover-logistics.jpg'),
};

const placeholder = require('@/assets/images/founder-hub/pallet-yard.jpg');

export function getHubImage(imageKey: string): ImageSourcePropType {
  return imageMap[imageKey] || placeholder;
}

export const hubImages = imageMap;
