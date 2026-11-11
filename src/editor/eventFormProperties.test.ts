import { describe, expect, it } from 'vitest';
import { mergeEventFormProperties } from './eventFormProperties';

describe('mergeEventFormProperties', () => {
  it('keeps event keys the form does not show and clears a form field the user emptied', () => {
    const existing = {
      tooltip: 'Door',
      activate: 'on_trigger',
      location: '2,3,1,1',
      requires_status: 'has_key',
      set_status: 'door_open',
      unset_status: 'door_closed',
      cutscene: 'cutscenes/door.txt',
      stash: 'private',
      repeat: 'true',
      intramap: '10,12',
      requires_not_status: 'door_open',
      requires_not_level: '10',
      requires_class: 'warrior',
      requires_not_class: 'mage',
      custom_note: 'keep',
    };
    const formProps = {
      activate: 'on_interact',
      location: '2,3,1,1',
      msg: 'The door opens.',
    };
    expect(mergeEventFormProperties(existing, formProps)).toEqual({
      tooltip: 'Door',
      set_status: 'door_open',
      unset_status: 'door_closed',
      cutscene: 'cutscenes/door.txt',
      stash: 'private',
      repeat: 'true',
      intramap: '10,12',
      requires_not_status: 'door_open',
      requires_not_level: '10',
      requires_class: 'warrior',
      requires_not_class: 'mage',
      custom_note: 'keep',
      activate: 'on_interact',
      location: '2,3,1,1',
      msg: 'The door opens.',
    });
  });
});
