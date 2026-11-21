import { useNavigate, useParams } from 'react-router-dom';
import { dataService, errorMessage } from '@/services';
import type { ContactInput } from '@/types';
import { useContact, useEffectiveSettings } from '@/hooks/useData';
import { invalidateQueries } from '@/hooks/useQuery';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactForm } from '@/components/contacts/ContactForm';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

export function ContactFormPage() {
  const { contactId } = useParams();
  const isEdit = !!contactId;
  const navigate = useNavigate();
  const toast = useToast();
  const { defaultCountryCode } = useEffectiveSettings();
  const { data: contact, error, isLoading, isFetching, refetch } = useContact(contactId);

  const handleSubmit = async (input: ContactInput) => {
    try {
      const saved = isEdit && contactId ? await dataService.updateContact(contactId, input) : await dataService.createContact(input);
      invalidateQueries('contacts:');
      toast.success(isEdit ? 'Contact updated' : 'Contact added');
      navigate(`/contacts/${saved.contactId}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const backTo = isEdit ? `/contacts/${contactId}` : '/contacts';
  const header = <PageHeader title={isEdit ? 'Edit contact' : 'New contact'} backTo={backTo} backLabel={isEdit ? 'Contact' : 'Contacts'} />;

  if (isEdit && isLoading) return <>{header}<LoadingState /></>;
  if (isEdit && (error || !contact)) return <>{header}<ErrorState error={error} onRetry={refetch} retrying={isFetching} /></>;

  return (
    <div className="mx-auto max-w-2xl">
      {header}
      <ContactForm
        key={contact?.updatedAt ?? 'new'}
        initial={contact}
        defaultCountryCode={defaultCountryCode}
        submitLabel={isEdit ? 'Save changes' : 'Add contact'}
        onSubmit={handleSubmit}
        onCancel={() => navigate(backTo)}
      />
    </div>
  );
}
