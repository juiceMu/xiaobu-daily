import React from 'react';
import { registerRootComponent } from 'expo';
import AcceptanceApp from './AcceptanceApp';

function FreshAcceptanceApp() {
  return <AcceptanceApp lanEnabled={false} demoControls />;
}

registerRootComponent(FreshAcceptanceApp);
