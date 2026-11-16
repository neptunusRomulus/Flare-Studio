import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EventSectionShell from './EventSectionShell';
import type { EventSectionProps } from './eventDialogModel';

type Props = EventSectionProps;

/** Event name and description. */
export default function EventInformationSection({ eventData, setEventData, expandedSections, toggleSection }: Props) {
  return (
    <EventSectionShell
      title="Event Information"
      icon={HelpCircle}
      id="event-information"
      isExpanded={expandedSections.eventInfo}
      onToggle={() => toggleSection('eventInfo')}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">Name</Label>
          <Input
            value={eventData.name}
            onChange={e => setEventData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Event Name (e.g. Teleport to Town, Boss Trigger)"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground/80">Description</Label>
          <Input
            value={eventData.description}
            onChange={e => setEventData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this event"
            className="h-8 text-sm"
          />
        </div>
      </div>
    </EventSectionShell>
  );
}
