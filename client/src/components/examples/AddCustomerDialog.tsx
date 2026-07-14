import { AddCustomerDialog } from '../AddCustomerDialog';

export default function AddCustomerDialogExample() {
  const handleAdd = (customer: { name: string; email: string; phone: string }) => {
    console.log('Adding customer:', customer);
  };

  return <AddCustomerDialog onAdd={handleAdd} />;
}
