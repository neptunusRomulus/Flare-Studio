import React from 'react';
import VendorDialogs from '@/components/VendorDialogs';

type VendorDialogsCtx = {
  vendorState: unknown;
  vendorHandlers: unknown;
};

export default function VendorDialogsContainer({ ctx }: { ctx: unknown }) {
  const c = ctx as VendorDialogsCtx;
  return (
    <VendorDialogs vendorState={c.vendorState} vendorHandlers={c.vendorHandlers} />
  );
}
