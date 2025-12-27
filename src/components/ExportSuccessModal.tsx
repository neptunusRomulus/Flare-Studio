import React from 'react';
import { X, Check, Folder } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const ExportSuccessModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg shadow-xl p-6 max-w-md mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Export Successful</h3>
        </div>

        <p className="text-gray-300 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-medium text-white">
            <Folder className="w-4 h-4" />
          </span>
          Project exported to project folder.
        </p>
      </div>
    </div>
  );
};

export default ExportSuccessModal;
