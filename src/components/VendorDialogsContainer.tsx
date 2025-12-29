import React from 'react';
import VendorDialogs from '@/components/VendorDialogs';

export default function VendorDialogsContainer({ ctx }: { ctx: any }) {
  const c = ctx as any;
  return (
    <VendorDialogs vendorState={c.vendorState} vendorHandlers={c.vendorHandlers} />
  );
}
