import React from 'react';

type Props = {
  exportStatus: { isExporting: boolean; exportProgress: number; isSaving?: boolean; saveProgress?: number };
};

/** Bottom of the right dock: export/save progress line (fixed height, so nothing shifts). */
const DockFooter: React.FC<Props> = ({ exportStatus: s }) => (
  <section className="flex-shrink-0 pt-2">
    <div className="w-full h-1.5">
      {s.isExporting ? (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${s.exportProgress}%` }} />
        </div>
      ) : s.isSaving ? (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${s.saveProgress ?? 0}%` }} />
        </div>
      ) : null}
    </div>
  </section>
);

export default DockFooter;
