import { ImportCustomersDialog } from '../ImportCustomersDialog';

export default function ImportCustomersDialogExample() {
  const handleImport = (file: File) => {
    console.log('Importing file:', file.name);
  };

  return <ImportCustomersDialog onImport={handleImport} />;
}
