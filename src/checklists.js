export const CHECKLISTS = {
  return: {
    title: 'Earth return familiarization',
    description: 'Observe the reconstructed Apollo 11 return sequence. Action and wait steps advance when the simulator reaches the requested state.',
    steps: [
      { id: 'return-intro', kind: 'note', title: 'Review the accuracy boundary', detail: 'The exterior is scan-based. Flight motion, cabin details, effects, and telemetry are educational reconstructions with compressed timing.' },
      { id: 'select-coast', kind: 'action', title: 'Select trans-Earth coast', detail: 'Use phase 02 to inspect Columbia in free flight.', target: '[data-phase="coast"]', when: (s) => s.phase === 'coast' },
      { id: 'fire-rcs', kind: 'action', title: 'Command an RCS pulse', detail: 'Use the RCS PULSE control or press R. The plume and pulse counter are visual teaching aids.', target: '#rcs-button', when: (s) => s.rcsPulseCount > 0 },
      { id: 'inspect-xray', kind: 'action', title: 'Inspect the cabin X-ray', detail: 'Open X-RAY display mode. The couches and console are schematic, not part of the Smithsonian scan.', target: '[data-view="xray"]', when: (s) => s.view === 'xray' },
      { id: 'select-entry', kind: 'action', title: 'Select atmospheric entry', detail: 'Use phase 03. Restore EXTERIOR mode if the cabin overlay is still open.', target: '[data-phase="entry"]', when: (s) => s.phase === 'entry' },
      { id: 'observe-heating', kind: 'wait', title: 'Observe peak entry heating', detail: 'Let the phase reach six seconds. Heating and load-factor values are representative, not integrated physics.', target: '#timeline', when: (s) => s.phase === 'entry' && s.phaseTime >= 6 },
      { id: 'select-drogue', kind: 'action', title: 'Deploy the drogue sequence', detail: 'Select phase 04 to observe forward heat-shield jettison and the two reconstructed drogues.', target: '[data-phase="drogue"]', when: (s) => s.phase === 'drogue' },
      { id: 'select-mains', kind: 'action', title: 'Deploy the main ringsails', detail: 'Select phase 05. The camera widens to include all three canopies.', target: '[data-phase="mains"]', when: (s) => s.phase === 'mains' },
      { id: 'observe-inflation', kind: 'wait', title: 'Observe main canopy inflation', detail: 'Let the main-parachute phase reach five seconds.', target: '#timeline', when: (s) => s.phase === 'mains' && s.phaseTime >= 5 },
      { id: 'select-splash', kind: 'action', title: 'Complete at splashdown', detail: 'Select phase 06 for the Pacific recovery configuration.', target: '[data-phase="splash"]', when: (s) => s.phase === 'splash' },
    ],
  },
  inspection: {
    title: 'Cabin and subsystem inspection',
    description: 'A shorter guide to the reconstruction layers and their provenance.',
    steps: [
      { id: 'inspection-intro', kind: 'note', title: 'Separate scan from reconstruction', detail: 'EXTERIOR shows the museum scan. X-RAY and SYSTEMS add schematic educational geometry.' },
      { id: 'show-xray', kind: 'action', title: 'Open cabin X-ray', detail: 'Inspect the three-couch teaching layout.', target: '[data-view="xray"]', when: (s) => s.view === 'xray' },
      { id: 'show-systems', kind: 'action', title: 'Open subsystem layout', detail: 'Inspect the parachute packs, tank ring, batteries, and console reconstruction.', target: '[data-view="systems"]', when: (s) => s.view === 'systems' },
      { id: 'show-exterior', kind: 'action', title: 'Return to the museum exterior', detail: 'Restore EXTERIOR display mode.', target: '[data-view="exterior"]', when: (s) => s.view === 'exterior' },
      { id: 'open-parameters', kind: 'note', title: 'Review parameter confidence', detail: 'Open MODEL DATA to see which values are sourced, derived, or estimated. Press Continue to finish.' },
    ],
  },
};

export function checklist(id) {
  return CHECKLISTS[id] || CHECKLISTS.return;
}

export function checklistStep(state) {
  const guide = checklist(state.checklist.guide);
  return guide.steps[state.checklist.index] || null;
}
