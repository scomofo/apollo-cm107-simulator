export const PARAMETER_DATA_VERSION = 1;

export const SOURCES = {
  'smithsonian-cm107': {
    title: 'Smithsonian National Air and Space Museum — Apollo 11 Command Module 3D record',
    locator: 'CM-107 Columbia, CC0 exterior photogrammetry package d8c6457e-4ebc-11ea-b77f-2e728ce88125',
    url: 'https://3d.si.edu/object/3d/command-module-apollo-11%3Ad8c63e8a-4ebc-11ea-b77f-2e728ce88125',
  },
  'scan-normalization': {
    title: 'Project scan normalization and measurement',
    locator: 'public/models/apollo-columbia.glb; normalized in src/scene.js',
  },
  'educational-reconstruction': {
    title: 'Project educational reconstruction',
    locator: 'Presentation parameter; not independently validated against historical flight or hardware data',
  },
};

// Confidence describes provenance, not physical precision. Estimated values are
// intentionally visible in the Model Data panel instead of masquerading as facts.
export const PARAMETERS = {
  'cm.baseDiameter': {
    label: 'Command Module base diameter', value: 3.912, unit: 'm', confidence: 'sourced',
    source: 'smithsonian-cm107', note: 'Block II base diameter used to normalize the museum scan.',
  },
  'cm.scanBodyHeight': {
    label: 'Scan body height after normalization', value: 2.718, unit: 'm', confidence: 'derived',
    source: 'scan-normalization', note: 'Measured from the normalized exterior asset; excludes the reconstructed probe.',
  },
  'cm.overallHeightWithProbe': {
    label: 'Overall height with reconstructed probe', value: 3.48, unit: 'm', confidence: 'derived',
    source: 'scan-normalization', note: 'Approximate combined scan and reconstruction bounds.',
  },
  'cm.launchMass': {
    label: 'Command Module launch mass', value: 5560, unit: 'kg', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Display value pending a document-level source locator.',
  },
  'rcs.thrustPerEngine': {
    label: 'RCS thrust per engine', value: 410, unit: 'N', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Used for the visual pulse label, not a force calculation.',
  },
  'rcs.pulseDuration': {
    label: 'Visual RCS pulse duration', value: 0.85, unit: 's', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Presentation timing; not a sourced valve-open duration.',
  },
  'els.drogueRadius': {
    label: 'Drogue canopy model radius', value: 2.5, unit: 'm', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Procedural canopy radius; 5.0 m model diameter.',
  },
  'els.mainRadius': {
    label: 'Main ringsail model radius', value: 12.74, unit: 'm', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Procedural canopy radius; approximately 25.5 m model diameter.',
  },
  'els.mainHangAngle': {
    label: 'Main-parachute hang angle', value: 27.5, unit: 'deg', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'Presentation attitude, not a dynamics solution.',
  },
  'presentation.phaseDuration': {
    label: 'Compressed duration per mission phase', value: 12, unit: 's', confidence: 'estimated',
    source: 'educational-reconstruction', note: 'User-interface timing; not historical event spacing.',
  },
};

export function parameter(id) {
  const entry = PARAMETERS[id];
  if (!entry) throw new Error(`Unknown simulation parameter: ${id}`);
  return entry.value;
}

export function parameterText(id, decimals = 2) {
  const entry = PARAMETERS[id];
  return `${entry.value.toLocaleString('en-US', { maximumFractionDigits: decimals })} ${entry.unit}`;
}
