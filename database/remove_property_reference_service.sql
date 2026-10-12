begin;

alter table public.pcm_property_references
  drop constraint if exists pcm_property_references_property_id_company_service_identif_key;

alter table public.pcm_property_references
  drop column if exists service;

alter table public.pcm_property_references
  add constraint pcm_property_references_property_company_name_identifier_key
  unique (property_id, company, identifier_type, identifier);

commit;
