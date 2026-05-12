import React from 'react';
import { Redirect } from 'expo-router';

// /service-hub/estimate-studio → redirect to default tab (Visuals)
export default function EstimateStudioIndex() {
  return <Redirect href={'/service-hub/estimate-studio/visuals' as any} />;
}
