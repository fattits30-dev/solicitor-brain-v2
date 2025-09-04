import { aiService } from './ai.js';
import { format, addDays /* addWeeks */ } from 'date-fns';

export interface CommunicationTemplate {
  id: string;
  name: string;
  category:
    | 'client_care'
    | 'progress_update'
    | 'billing'
    | 'appointment'
    | 'completion'
    | 'compliance'
    | 'marketing';
  subject_template: string;
  body_template: string;
  recipient_type: 'client' | 'opposing_party' | 'court' | 'third_party';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  requires_approval: boolean;
  approver_role?: string;
  auto_send_triggers: AutoSendTrigger[];
  variables: TemplateVariable[];
  compliance_requirements: string[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'date' | 'currency' | 'number' | 'address' | 'select';
  required: boolean;
  default_value?: string;
  options?: string[]; // For select type
  source?: string; // Where to auto-populate from
}

export interface AutoSendTrigger {
  event:
    | 'case_opened'
    | 'milestone_reached'
    | 'deadline_approaching'
    | 'payment_due'
    | 'document_ready'
    | 'appointment_scheduled';
  delay_hours?: number;
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }>;
}

export interface CommunicationRecord {
  id: string;
  case_id: string;
  client_id: string;
  template_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  method: 'email' | 'post' | 'sms' | 'portal';
  attachments: Array<{
    filename: string;
    path: string;
    size: number;
  }>;
  metadata: {
    created_at: Date;
    created_by: string;
    auto_generated: boolean;
    template_variables: Record<string, any>;
    approval_history?: Array<{
      approver: string;
      action: 'approved' | 'rejected' | 'requested_changes';
      timestamp: Date;
      comments?: string;
    }>;
  };
}

export interface ClientUpdate {
  case_id: string;
  client_id: string;
  update_type: 'progress' | 'milestone' | 'deadline' | 'billing' | 'completion' | 'issue';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  include_next_steps: boolean;
  attachments?: string[];
  requires_response: boolean;
  response_deadline?: Date;
}

export interface AppointmentCommunication {
  appointment_id: string;
  client_id: string;
  appointment_type:
    | 'initial_consultation'
    | 'progress_meeting'
    | 'court_hearing'
    | 'signing'
    | 'other';
  date_time: Date;
  location: string;
  duration_minutes: number;
  preparation_required?: string[];
  documents_to_bring?: string[];
  reminder_schedule: Array<{
    days_before: number;
    method: 'email' | 'sms' | 'post';
    template_id: string;
  }>;
}

export interface BillingCommunication {
  invoice_id: string;
  client_id: string;
  case_id: string;
  amount: number;
  due_date: Date;
  payment_methods: string[];
  work_description: string;
  time_entries: Array<{
    date: Date;
    description: string;
    hours: number;
    rate: number;
    amount: number;
  }>;
  previous_balance?: number;
}

class ClientCommunicationService {
  // Standard communication templates
  private communicationTemplates: CommunicationTemplate[] = [
    {
      id: 'client-care-letter',
      name: 'Client Care Letter',
      category: 'client_care',
      subject_template: 'Welcome to {{firm_name}} - Your Legal Matter: {{case_title}}',
      body_template: `Dear {{client_name}},

Thank you for instructing {{firm_name}} to act for you in connection with {{case_description}}.

TERMS OF BUSINESS
I confirm that our terms of business were provided to you and are available on our website. Please contact us if you require another copy.

YOUR MATTER
We have opened a file under reference {{matter_reference}} for your matter. Your main contact will be {{solicitor_name}} ({{solicitor_email}}, {{solicitor_phone}}).

COSTS
Our estimated costs for this matter are £{{estimated_costs}}. We will provide regular updates on costs incurred and will notify you if we expect to exceed this estimate.

{{#if legal_aid}}
This matter is covered by Legal Aid. We will notify you of any changes to your legal aid status.
{{/if}}

NEXT STEPS
{{next_steps}}

If you have any questions or concerns, please do not hesitate to contact us.

Yours sincerely,

{{solicitor_name}}
{{solicitor_title}}
{{firm_name}}

---
This communication is confidential and may be legally privileged. If you are not the intended recipient, please notify us immediately.`,
      recipient_type: 'client',
      urgency: 'medium',
      requires_approval: false,
      auto_send_triggers: [
        {
          event: 'case_opened',
          delay_hours: 2,
        },
      ],
      variables: [
        {
          name: 'client_name',
          description: 'Client full name',
          type: 'text',
          required: true,
          source: 'client.name',
        },
        {
          name: 'case_title',
          description: 'Short case title',
          type: 'text',
          required: true,
          source: 'case.title',
        },
        {
          name: 'case_description',
          description: 'Brief case description',
          type: 'text',
          required: true,
          source: 'case.description',
        },
        {
          name: 'matter_reference',
          description: 'Matter reference number',
          type: 'text',
          required: true,
          source: 'case.reference',
        },
        {
          name: 'solicitor_name',
          description: 'Solicitor name',
          type: 'text',
          required: true,
          source: 'solicitor.name',
        },
        {
          name: 'estimated_costs',
          description: 'Estimated costs',
          type: 'currency',
          required: true,
        },
      ],
      compliance_requirements: ['SRA Principle 5', 'SRA Code of Conduct 8.7'],
    },
    {
      id: 'progress-update',
      name: 'Case Progress Update',
      category: 'progress_update',
      subject_template: 'Update on your case: {{case_title}} - {{update_type}}',
      body_template: `Dear {{client_name}},

I am writing to provide you with an update on the progress of your case.

CURRENT STATUS
{{current_status}}

RECENT DEVELOPMENTS
{{recent_developments}}

{{#if next_steps}}
NEXT STEPS
{{next_steps}}
{{/if}}

{{#if deadlines}}
IMPORTANT DEADLINES
{{deadlines}}
{{/if}}

{{#if action_required}}
ACTION REQUIRED FROM YOU
{{action_required}}
Please respond by {{response_deadline}}.
{{/if}}

COSTS UPDATE
Costs incurred to date: £{{costs_to_date}}
{{#if costs_estimate_exceeded}}
Please note that costs may exceed our original estimate due to {{cost_variance_reason}}.
{{/if}}

Please contact me if you have any questions or concerns.

Yours sincerely,

{{solicitor_name}}
{{solicitor_title}}
{{firm_name}}`,
      recipient_type: 'client',
      urgency: 'medium',
      requires_approval: false,
      auto_send_triggers: [
        {
          event: 'milestone_reached',
          delay_hours: 24,
        },
      ],
      variables: [
        {
          name: 'current_status',
          description: 'Current case status',
          type: 'text',
          required: true,
        },
        {
          name: 'recent_developments',
          description: 'Recent developments',
          type: 'text',
          required: true,
        },
        { name: 'next_steps', description: 'Next steps planned', type: 'text', required: false },
        {
          name: 'costs_to_date',
          description: 'Costs incurred to date',
          type: 'currency',
          required: true,
        },
      ],
      compliance_requirements: ['Regular client communication', 'Cost transparency'],
    },
    {
      id: 'appointment-confirmation',
      name: 'Appointment Confirmation',
      category: 'appointment',
      subject_template: 'Appointment Confirmation - {{appointment_date}}',
      body_template: `Dear {{client_name}},

This confirms your appointment details:

DATE & TIME: {{appointment_date}} at {{appointment_time}}
LOCATION: {{appointment_location}}
DURATION: Approximately {{duration}} minutes
PURPOSE: {{appointment_purpose}}

{{#if preparation_required}}
PREPARATION REQUIRED
Please ensure you:
{{preparation_required}}
{{/if}}

{{#if documents_needed}}
DOCUMENTS TO BRING
Please bring the following documents:
{{documents_needed}}
{{/if}}

{{#if parking_info}}
PARKING: {{parking_info}}
{{/if}}

If you need to reschedule or cancel, please contact us at least 24 hours in advance.

We look forward to seeing you.

{{solicitor_name}}
{{firm_name}}`,
      recipient_type: 'client',
      urgency: 'medium',
      requires_approval: false,
      auto_send_triggers: [
        {
          event: 'appointment_scheduled',
          delay_hours: 1,
        },
      ],
      variables: [
        { name: 'appointment_date', description: 'Appointment date', type: 'date', required: true },
        { name: 'appointment_time', description: 'Appointment time', type: 'text', required: true },
        {
          name: 'appointment_location',
          description: 'Meeting location',
          type: 'address',
          required: true,
        },
        {
          name: 'appointment_purpose',
          description: 'Purpose of meeting',
          type: 'text',
          required: true,
        },
      ],
      compliance_requirements: [],
    },
    {
      id: 'invoice-notification',
      name: 'Invoice Notification',
      category: 'billing',
      subject_template: 'Invoice {{invoice_number}} - £{{invoice_amount}}',
      body_template: `Dear {{client_name}},

Please find attached our invoice {{invoice_number}} dated {{invoice_date}} in the amount of £{{invoice_amount}}.

PAYMENT DETAILS
Amount Due: £{{invoice_amount}}
Due Date: {{due_date}}
Payment Reference: {{invoice_number}}

{{#if work_summary}}
WORK SUMMARY
{{work_summary}}
{{/if}}

PAYMENT METHODS
{{payment_methods}}

{{#if payment_plan_available}}
If you would like to discuss payment arrangements, please contact us immediately.
{{/if}}

Please ensure payment is made by the due date to avoid any delays in progressing your matter.

Thank you for your prompt attention to this invoice.

{{accounts_team_name}}
{{firm_name}}`,
      recipient_type: 'client',
      urgency: 'high',
      requires_approval: true,
      approver_role: 'partner',
      auto_send_triggers: [
        {
          event: 'payment_due',
          delay_hours: 0,
        },
      ],
      variables: [
        { name: 'invoice_number', description: 'Invoice number', type: 'text', required: true },
        { name: 'invoice_amount', description: 'Invoice amount', type: 'currency', required: true },
        { name: 'due_date', description: 'Payment due date', type: 'date', required: true },
        {
          name: 'work_summary',
          description: 'Summary of work done',
          type: 'text',
          required: false,
        },
      ],
      compliance_requirements: ['SRA Accounts Rules', 'Clear payment terms'],
    },
    {
      id: 'matter-completion',
      name: 'Matter Completion Letter',
      category: 'completion',
      subject_template: 'Completion of your matter: {{case_title}}',
      body_template: `Dear {{client_name}},

I am pleased to confirm that we have successfully completed your matter regarding {{case_description}}.

OUTCOME
{{outcome_summary}}

{{#if final_documents}}
FINAL DOCUMENTS
The following final documents are enclosed/attached:
{{final_documents}}
{{/if}}

FINAL COSTS
Total costs for this matter: £{{final_costs}}
{{#if outstanding_balance}}
Outstanding balance: £{{outstanding_balance}}
Please arrange payment by {{payment_due_date}}.
{{/if}}

{{#if future_obligations}}
ONGOING OBLIGATIONS
Please note the following ongoing obligations:
{{future_obligations}}
{{/if}}

FILE STORAGE
We will retain your file for {{retention_period}} years in accordance with our retention policy. After this period, the file will be securely destroyed unless you request its return.

FEEDBACK
We value your feedback on our service. If you would be willing to provide a review or testimonial, it would be greatly appreciated.

Thank you for instructing {{firm_name}}. We hope we can assist you with any future legal matters.

{{solicitor_name}}
{{solicitor_title}}
{{firm_name}}`,
      recipient_type: 'client',
      urgency: 'low',
      requires_approval: true,
      approver_role: 'partner',
      auto_send_triggers: [
        {
          event: 'milestone_reached',
          conditions: [{ field: 'case_status', operator: 'equals', value: 'completed' }],
        },
      ],
      variables: [
        {
          name: 'outcome_summary',
          description: 'Summary of case outcome',
          type: 'text',
          required: true,
        },
        { name: 'final_costs', description: 'Total final costs', type: 'currency', required: true },
        {
          name: 'retention_period',
          description: 'File retention period',
          type: 'number',
          required: true,
          default_value: '7',
        },
      ],
      compliance_requirements: ['File retention policy', 'Final costs disclosure'],
    },
  ];

  /**
   * Get all communication templates
   */
  getCommunicationTemplates(): CommunicationTemplate[] {
    return [...this.communicationTemplates];
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): CommunicationTemplate | null {
    return this.communicationTemplates.find((t) => t.id === templateId) || null;
  }

  /**
   * Generate communication from template
   */
  async generateCommunication(
    templateId: string,
    variables: Record<string, any>,
    caseData?: any,
    clientData?: any,
    recipientOverride?: string,
  ): Promise<{
    subject: string;
    body: string;
    recipient: string;
    variables_used: Record<string, any>;
    missing_variables: string[];
    compliance_warnings: string[];
  }> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Communication template ${templateId} not found`);
    }

    // Auto-populate variables from case/client data
    const enrichedVariables = await this.autoPopulateVariables(
      template,
      variables,
      caseData,
      clientData,
    );

    // Check for missing required variables
    const missingVariables = template.variables
      .filter((v) => v.required && !enrichedVariables[v.name])
      .map((v) => v.name);

    // Process templates using simple replacement (in production, use proper template engine)
    let subject = template.subject_template;
    let body = template.body_template;

    // Replace variables
    for (const [key, value] of Object.entries(enrichedVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, String(value || ''));
      body = body.replace(regex, String(value || ''));
    }

    // Handle conditional blocks
    body = this.processConditionals(body, enrichedVariables);

    // Determine recipient
    const recipient = recipientOverride || clientData?.email || 'recipient@example.com';

    // Check compliance
    const complianceWarnings = await this.checkCompliance(template, enrichedVariables, body);

    return {
      subject,
      body,
      recipient,
      variables_used: enrichedVariables,
      missing_variables: missingVariables,
      compliance_warnings: complianceWarnings,
    };
  }

  /**
   * Send client update
   */
  async sendClientUpdate(update: ClientUpdate): Promise<CommunicationRecord> {
    try {
      // Use AI to enhance the update content
      const enhancedContent = await aiService.generateDraft(
        `Enhance this client update for professional communication:
         
         Type: ${update.update_type}
         Title: ${update.title}
         Content: ${update.content}
         Priority: ${update.priority}
         
         Make it clear, professional, and appropriately detailed for a client.`,
        'You are drafting client communications for a UK law firm. Be professional, clear, and reassuring.',
      );

      const communication = await this.generateCommunication('progress-update', {
        current_status: update.title,
        recent_developments: enhancedContent,
        next_steps: update.include_next_steps ? 'We will keep you updated on progress.' : '',
        costs_to_date: '0', // Would be populated from actual case data
      });

      const record: CommunicationRecord = {
        id: `comm_${Date.now()}`,
        case_id: update.case_id,
        client_id: update.client_id,
        template_id: 'progress-update',
        recipient_email: communication.recipient,
        recipient_name: 'Client', // Would be populated from client data
        subject: communication.subject,
        body: communication.body,
        status: 'draft',
        method: 'email',
        attachments: [],
        metadata: {
          created_at: new Date(),
          created_by: 'system',
          auto_generated: true,
          template_variables: communication.variables_used,
        },
      };

      return record;
    } catch (error) {
      console.error('Client update generation failed:', error);
      throw new Error('Failed to generate client update');
    }
  }

  /**
   * Schedule appointment communications
   */
  async scheduleAppointmentCommunications(appointment: AppointmentCommunication): Promise<
    Array<{
      communication_id: string;
      scheduled_send_time: Date;
      template_id: string;
      method: string;
    }>
  > {
    const scheduledCommunications = [];

    for (const reminder of appointment.reminder_schedule) {
      const sendTime = addDays(appointment.date_time, -reminder.days_before);

      const _communication = await this.generateCommunication(reminder.template_id, {
        appointment_date: format(appointment.date_time, 'EEEE, dd MMMM yyyy'),
        appointment_time: format(appointment.date_time, 'HH:mm'),
        appointment_location: appointment.location,
        duration: appointment.duration_minutes.toString(),
        appointment_purpose: appointment.appointment_type.replace('_', ' '),
      });

      scheduledCommunications.push({
        communication_id: `sched_${Date.now()}_${reminder.days_before}`,
        scheduled_send_time: sendTime,
        template_id: reminder.template_id,
        method: reminder.method,
      });
    }

    return scheduledCommunications;
  }

  /**
   * Generate invoice communication
   */
  async generateInvoiceCommunication(billing: BillingCommunication): Promise<CommunicationRecord> {
    const workSummary = billing.time_entries
      .map(
        (entry) =>
          `${format(entry.date, 'dd/MM/yyyy')}: ${entry.description} (${entry.hours}h @ £${entry.rate}/h = £${entry.amount})`,
      )
      .join('\n');

    const paymentMethods = billing.payment_methods.join('\n');

    const communication = await this.generateCommunication('invoice-notification', {
      invoice_number: billing.invoice_id,
      invoice_amount: billing.amount.toFixed(2),
      invoice_date: format(new Date(), 'dd MMMM yyyy'),
      due_date: format(billing.due_date, 'dd MMMM yyyy'),
      work_summary: workSummary,
      payment_methods: paymentMethods,
    });

    const record: CommunicationRecord = {
      id: `inv_comm_${Date.now()}`,
      case_id: billing.case_id,
      client_id: billing.client_id,
      template_id: 'invoice-notification',
      recipient_email: communication.recipient,
      recipient_name: 'Client',
      subject: communication.subject,
      body: communication.body,
      status: 'pending_approval', // Billing communications typically require approval
      method: 'email',
      attachments: [
        {
          filename: `Invoice_${billing.invoice_id}.pdf`,
          path: `/invoices/${billing.invoice_id}.pdf`,
          size: 0,
        },
      ],
      metadata: {
        created_at: new Date(),
        created_by: 'system',
        auto_generated: true,
        template_variables: communication.variables_used,
      },
    };

    return record;
  }

  /**
   * Auto-populate template variables
   */
  private async autoPopulateVariables(
    template: CommunicationTemplate,
    providedVariables: Record<string, any>,
    caseData?: any,
    clientData?: any,
  ): Promise<Record<string, any>> {
    const populated = { ...providedVariables };

    for (const variable of template.variables) {
      if (populated[variable.name]) continue; // Already provided

      if (variable.source) {
        const [source, field] = variable.source.split('.');
        const sourceData =
          source === 'client'
            ? clientData
            : source === 'case'
              ? caseData
              : source === 'solicitor'
                ? { name: 'Solicitor Name', email: 'solicitor@firm.com' }
                : null;

        if (sourceData && sourceData[field]) {
          populated[variable.name] = sourceData[field];
        }
      }

      if (!populated[variable.name] && variable.default_value) {
        populated[variable.name] = variable.default_value;
      }
    }

    // Add standard firm variables
    populated['firm_name'] = populated['firm_name'] || 'Legal Firm Name';
    populated['solicitor_name'] = populated['solicitor_name'] || 'Solicitor Name';
    populated['solicitor_title'] = populated['solicitor_title'] || 'Solicitor';

    return populated;
  }

  /**
   * Process conditional blocks in templates
   */
  private processConditionals(content: string, variables: Record<string, any>): string {
    // Handle {{#if variable}} blocks
    const ifRegex = /{{#if (\w+)}}(.*?){{\/if}}/gs;

    return content.replace(ifRegex, (match, variableName, block) => {
      const value = variables[variableName];
      return value && value !== '' && value !== '0' && value !== 'false' ? block : '';
    });
  }

  /**
   * Check compliance requirements
   */
  private async checkCompliance(
    template: CommunicationTemplate,
    variables: Record<string, any>,
    content: string,
  ): Promise<string[]> {
    const warnings: string[] = [];

    // Check for required compliance elements
    for (const requirement of template.compliance_requirements) {
      if (requirement === 'SRA Principle 5' && !content.includes('costs')) {
        warnings.push('Cost information may be required for SRA Principle 5 compliance');
      }

      if (requirement === 'Clear payment terms' && template.category === 'billing') {
        if (!content.includes('due date') || !content.includes('payment method')) {
          warnings.push('Payment terms must be clearly stated');
        }
      }
    }

    // Check for confidentiality notice in client communications
    if (template.recipient_type === 'client' && !content.includes('confidential')) {
      warnings.push('Consider adding confidentiality notice');
    }

    return warnings;
  }

  /**
   * AI-powered communication optimization
   */
  async optimizeCommunication(
    subject: string,
    body: string,
    recipient_type: string,
    urgency: string,
  ): Promise<{
    optimized_subject: string;
    optimized_body: string;
    improvements: string[];
    tone_analysis: {
      current_tone: string;
      recommended_tone: string;
      adjustments: string[];
    };
    clarity_score: number;
  }> {
    try {
      const optimization = await aiService.generateDraft(
        `Optimize this legal communication for clarity and professionalism:
         
         Subject: ${subject}
         Body: ${body}
         Recipient: ${recipient_type}
         Urgency: ${urgency}
         
         Improve:
         1. Clarity and readability
         2. Professional tone
         3. Structure and formatting
         4. Client-friendly language
         
         Maintain legal accuracy and all key information.`,
        'You are optimizing client communications for a UK law firm. Focus on clarity and professionalism.',
      );

      return {
        optimized_subject: subject, // Would be enhanced by AI
        optimized_body: optimization.substring(0, 2000),
        improvements: [
          'Improved clarity of technical terms',
          'Enhanced professional tone',
          'Better structure and formatting',
        ],
        tone_analysis: {
          current_tone: 'professional',
          recommended_tone: 'professional but approachable',
          adjustments: ['Use more accessible language', 'Add reassuring elements'],
        },
        clarity_score: 8.5,
      };
    } catch (error) {
      console.error('Communication optimization failed:', error);
      return {
        optimized_subject: subject,
        optimized_body: body,
        improvements: ['Manual review recommended'],
        tone_analysis: {
          current_tone: 'unknown',
          recommended_tone: 'professional',
          adjustments: ['Review and optimize manually'],
        },
        clarity_score: 7.0,
      };
    }
  }

  /**
   * Track communication effectiveness
   */
  getCommunicationMetrics(_templateId?: string): {
    total_sent: number;
    delivery_rate: number;
    open_rate: number;
    response_rate: number;
    client_satisfaction: number;
    common_issues: Array<{ issue: string; frequency: number }>;
    optimization_suggestions: string[];
  } {
    // Would query actual metrics from database
    return {
      total_sent: 150,
      delivery_rate: 0.98,
      open_rate: 0.85,
      response_rate: 0.45,
      client_satisfaction: 4.2,
      common_issues: [
        { issue: 'Technical language too complex', frequency: 12 },
        { issue: 'Missing cost information', frequency: 8 },
      ],
      optimization_suggestions: [
        'Simplify technical language',
        'Include more cost transparency',
        'Add more reassuring language',
      ],
    };
  }

  /**
   * Generate mass communication
   */
  async generateMassCommunication(
    template_id: string,
    recipients: Array<{
      client_id: string;
      case_id?: string;
      variables: Record<string, any>;
    }>,
    _send_delay_hours = 0,
  ): Promise<{
    communications: CommunicationRecord[];
    errors: Array<{ client_id: string; error: string }>;
    scheduled_send_time: Date;
  }> {
    const communications: CommunicationRecord[] = [];
    const errors: Array<{ client_id: string; error: string }> = [];

    for (const recipient of recipients) {
      try {
        const communication = await this.generateCommunication(template_id, recipient.variables);

        const record: CommunicationRecord = {
          id: `mass_${Date.now()}_${recipient.client_id}`,
          case_id: recipient.case_id || '',
          client_id: recipient.client_id,
          template_id,
          recipient_email: communication.recipient,
          recipient_name: recipient.variables.client_name || 'Client',
          subject: communication.subject,
          body: communication.body,
          status: 'draft',
          method: 'email',
          attachments: [],
          metadata: {
            created_at: new Date(),
            created_by: 'system',
            auto_generated: true,
            template_variables: communication.variables_used,
          },
        };

        communications.push(record);
      } catch (error) {
        errors.push({
          client_id: recipient.client_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      communications,
      errors,
      scheduled_send_time: addDays(new Date(), _send_delay_hours / 24),
    };
  }
}

// Create singleton instance
export const clientCommunicationService = new ClientCommunicationService();
