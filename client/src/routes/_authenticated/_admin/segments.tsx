import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Segments, CUSTOMER_SEGMENTS } from '@/features/customers';
import { listSearchSchema } from '@/shared/lib/listSearch';

/** The selected segment lives in the URL, so a filtered view can be shared. */
export const segmentsSearchSchema = listSearchSchema.extend({
  segment: z.enum(CUSTOMER_SEGMENTS).optional().catch(undefined),
});

export const Route = createFileRoute('/_authenticated/_admin/segments')({
  validateSearch: segmentsSearchSchema,
  component: Segments,
});
