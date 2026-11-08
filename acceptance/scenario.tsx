import React, { useEffect, useState } from 'react';
import { registerRootComponent } from 'expo';
import { getInitialURL } from 'expo-linking';
import AcceptanceApp from './AcceptanceApp';
import { nativeRepository } from '../src/state/nativeRepository';
import { installSaveObservation } from './saveObservation';
import { themePreferenceRepository } from '../src/state/themeStorage';
import { installThemePreferenceControl } from './themePreferenceControl';
import { prepareThemeColdStart } from './themeColdStart';

const observation = installSaveObservation(nativeRepository);
const themePreferenceControl = installThemePreferenceControl(
  themePreferenceRepository,
);
// 每个模块实例只判定一次；不因根组件重新渲染而再次待命。
const coldStart = prepareThemeColdStart(getInitialURL, themePreferenceControl);

function ScenarioAcceptanceApp() {
  const [coldStartMessage, setColdStartMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void coldStart.then((message) => {
      if (active) setColdStartMessage(message);
    });
    return () => {
      active = false;
    };
  }, []);
  if (coldStartMessage === null) return null;
  return (
    <AcceptanceApp
      lanEnabled={false}
      demoControls
      observation={observation}
      themePreferenceControl={themePreferenceControl}
      themeColdStartMessage={coldStartMessage}
    />
  );
}

registerRootComponent(ScenarioAcceptanceApp);
