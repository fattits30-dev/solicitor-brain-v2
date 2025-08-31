import { aiService } from './ai.js';
import { format, addDays } from 'date-fns';

export interface FormTemplate {
  id: string;
  name: string;
  category: 'hmcts' | 'legal_aid' | 'land_registry' | 'companies_house' | 'tribunal' | 'other';
  version: string;
  description: string;
  fields: FormField[];
  sections: FormSection[];
  validation_rules: ValidationRule[];
  submission_method: 'online' | 'post' | 'email' | 'in_person';
  fee?: number;
  processing_time?: string;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'currency' | 'postcode';
  section: string;
  required: boolean;
  max_length?: number;
  options?: string[]; // For select/radio fields
  validation?: string; // Regex pattern
  auto_populate?: string; // Source for auto-population
  help_text?: string;
  dependency?: {
    field: string;
    condition: string;
    value: string;
  };
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  conditional?: {
    field: string;
    value: string;
  };
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'min_length' | 'max_length' | 'pattern' | 'numeric' | 'date_format' | 'custom';
  value?: string | number;
  message: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  case_id?: string;
  client_id?: string;
  data: Record<string, any>;
  status: 'draft' | 'validated' | 'submitted' | 'accepted' | 'rejected';
  submission_date?: Date;
  reference_number?: string;
  validation_errors: Array<{
    field: string;
    message: string;
  }>;
  metadata: {
    created_at: Date;
    updated_at: Date;
    submitted_by: string;
    auto_populated_fields: string[];
  };
}

export interface DataExtractionResult {
  extracted_fields: Record<string, any>;
  confidence_scores: Record<string, number>;
  missing_fields: string[];
  validation_warnings: string[];
  source_document: string;
}

class FormAutomationService {
  
  // HMCTS forms database
  private hmctsForms: FormTemplate[] = [
    {
      id: 'n1-claim-form',
      name: 'N1 Claim Form',
      category: 'hmcts',
      version: '2023',
      description: 'Money Claims Online - Claim Form',
      submission_method: 'online',
      fee: 154,
      processing_time: '5-7 days',
      fields: [
        {
          id: 'claimant_name',
          name: 'claimantName',
          label: 'Claimant Name (including title)',
          type: 'text',
          section: 'claimant_details',
          required: true,
          max_length: 100,
          auto_populate: 'client.name'
        },
        {
          id: 'claimant_address',
          name: 'claimantAddress',
          label: 'Claimant Address',
          type: 'textarea',
          section: 'claimant_details',
          required: true,
          auto_populate: 'client.address'
        },
        {
          id: 'claimant_postcode',
          name: 'claimantPostcode',
          label: 'Postcode',
          type: 'postcode',
          section: 'claimant_details',
          required: true,
          validation: '^[A-Z]{1,2}[0-9]{1,2}\\s?[0-9][A-Z]{2}$',
          auto_populate: 'client.postcode'
        },
        {
          id: 'defendant_name',
          name: 'defendantName',
          label: 'Defendant Name',
          type: 'text',
          section: 'defendant_details',
          required: true,
          max_length: 100
        },
        {
          id: 'defendant_address',
          name: 'defendantAddress',
          label: 'Defendant Address',
          type: 'textarea',
          section: 'defendant_details',
          required: true
        },
        {
          id: 'claim_amount',
          name: 'claimAmount',
          label: 'Claim Amount (£)',
          type: 'currency',
          section: 'claim_details',
          required: true,
          help_text: 'Enter the total amount you are claiming'
        },
        {
          id: 'interest_claimed',
          name: 'interestClaimed',
          label: 'Interest claimed',
          type: 'checkbox',
          section: 'claim_details',
          required: false
        },
        {
          id: 'brief_details',
          name: 'briefDetails',
          label: 'Brief details of claim',
          type: 'textarea',
          section: 'claim_details',
          required: true,
          max_length: 1080,
          help_text: 'Summarise what your claim is about and what you want the court to decide'
        }
      ],
      sections: [
        {
          id: 'claimant_details',
          title: 'Claimant Details',
          description: 'Details of the person making the claim',
          order: 1
        },
        {
          id: 'defendant_details',
          title: 'Defendant Details',
          description: 'Details of the person being sued',
          order: 2
        },
        {
          id: 'claim_details',
          title: 'Claim Details',
          description: 'Details of what you are claiming',
          order: 3
        }
      ],
      validation_rules: [
        {
          field: 'claimant_name',
          rule: 'required',
          message: 'Claimant name is required'
        },
        {
          field: 'claim_amount',
          rule: 'numeric',
          message: 'Claim amount must be a valid number'
        },
        {
          field: 'brief_details',
          rule: 'min_length',
          value: 50,
          message: 'Brief details must be at least 50 characters'
        }
      ]
    },
    {
      id: 'n244-application',
      name: 'N244 Application Notice',
      category: 'hmcts',
      version: '2023',
      description: 'General Application to Court',
      submission_method: 'post',
      fee: 154,
      fields: [
        {
          id: 'case_number',
          name: 'caseNumber',
          label: 'Case Number',
          type: 'text',
          section: 'case_details',
          required: true,
          help_text: 'Enter the case number for the existing case'
        },
        {
          id: 'applicant_name',
          name: 'applicantName',
          label: 'Name of Applicant',
          type: 'text',
          section: 'applicant_details',
          required: true,
          auto_populate: 'client.name'
        },
        {
          id: 'application_type',
          name: 'applicationType',
          label: 'Type of Application',
          type: 'select',
          section: 'application_details',
          required: true,
          options: [
            'Extension of time',
            'Permission to amend',
            'Summary judgment',
            'Strike out',
            'Set aside judgment',
            'Other'
          ]
        },
        {
          id: 'order_sought',
          name: 'orderSought',
          label: 'Order or direction sought',
          type: 'textarea',
          section: 'application_details',
          required: true,
          help_text: 'Set out the order you want the court to make'
        },
        {
          id: 'grounds',
          name: 'grounds',
          label: 'Grounds for application',
          type: 'textarea',
          section: 'application_details',
          required: true,
          help_text: 'Explain why you are making this application'
        }
      ],
      sections: [
        {
          id: 'case_details',
          title: 'Case Details',
          order: 1
        },
        {
          id: 'applicant_details',
          title: 'Applicant Details',
          order: 2
        },
        {
          id: 'application_details',
          title: 'Application Details',
          order: 3
        }
      ],
      validation_rules: [
        {
          field: 'order_sought',
          rule: 'min_length',
          value: 20,
          message: 'Order sought must be clearly described'
        }
      ]
    }
  ];

  // Legal Aid forms
  private legalAidForms: FormTemplate[] = [
    {
      id: 'cw1-legal-aid',
      name: 'CW1 Application for Legal Aid',
      category: 'legal_aid',
      version: '2023',
      description: 'Application for Civil Legal Aid',
      submission_method: 'online',
      fields: [
        {
          id: 'client_name',
          name: 'clientName',
          label: 'Client Full Name',
          type: 'text',
          section: 'client_details',
          required: true,
          auto_populate: 'client.name'
        },
        {
          id: 'client_dob',
          name: 'clientDOB',
          label: 'Date of Birth',
          type: 'date',
          section: 'client_details',
          required: true,
          auto_populate: 'client.date_of_birth'
        },
        {
          id: 'client_ni_number',
          name: 'clientNINumber',
          label: 'National Insurance Number',
          type: 'text',
          section: 'client_details',
          required: true,
          validation: '^[A-Z]{2}[0-9]{6}[A-Z]{1}$',
          auto_populate: 'client.ni_number'
        },
        {
          id: 'case_type',
          name: 'caseType',
          label: 'Type of Case',
          type: 'select',
          section: 'case_details',
          required: true,
          options: [
            'Housing',
            'Family',
            'Immigration',
            'Clinical Negligence',
            'Personal Injury',
            'Public Law',
            'Other'
          ]
        },
        {
          id: 'income',
          name: 'income',
          label: 'Monthly Income (£)',
          type: 'currency',
          section: 'financial_details',
          required: true,
          help_text: 'Include all sources of income'
        },
        {
          id: 'capital',
          name: 'capital',
          label: 'Capital/Savings (£)',
          type: 'currency',
          section: 'financial_details',
          required: true,
          help_text: 'Include bank accounts, investments, property equity'
        },
        {
          id: 'benefits',
          name: 'benefits',
          label: 'Receiving means-tested benefits',
          type: 'checkbox',
          section: 'financial_details',
          required: false,
          help_text: 'Income Support, ESA, JSA, Universal Credit, etc.'
        }
      ],
      sections: [
        {
          id: 'client_details',
          title: 'Client Details',
          order: 1
        },
        {
          id: 'case_details',
          title: 'Case Information',
          order: 2
        },
        {
          id: 'financial_details',
          title: 'Financial Information',
          order: 3
        }
      ],
      validation_rules: [
        {
          field: 'client_ni_number',
          rule: 'pattern',
          value: '^[A-Z]{2}[0-9]{6}[A-Z]{1}$',
          message: 'National Insurance number format invalid'
        }
      ]
    }
  ];

  /**
   * Get all available forms
   */
  getAllForms(): FormTemplate[] {
    return [...this.hmctsForms, ...this.legalAidForms];
  }

  /**
   * Get form template by ID
   */
  getFormTemplate(formId: string): FormTemplate | null {
    return this.getAllForms().find(form => form.id === formId) || null;
  }

  /**
   * Auto-populate form from case/client data
   */
  async autoPopulateForm(
    formId: string,
    caseData: any,
    clientData: any,
    documentText?: string
  ): Promise<{
    populated_fields: Record<string, any>;
    extraction_results?: DataExtractionResult;
    confidence_score: number;
    missing_required_fields: string[];
  }> {
    const template = this.getFormTemplate(formId);
    if (!template) {
      throw new Error(`Form template ${formId} not found`);
    }

    const populatedFields: Record<string, any> = {};
    const autoPopulatedFields: string[] = [];
    let overallConfidence = 0;
    let fieldCount = 0;

    // 1. Auto-populate from structured data
    for (const field of template.fields) {
      if (field.auto_populate) {
        const value = this.extractFieldValue(field.auto_populate, clientData, caseData);
        if (value !== null && value !== undefined) {
          populatedFields[field.name] = value;
          autoPopulatedFields.push(field.name);
          overallConfidence += 0.9; // High confidence for structured data
          fieldCount++;
        }
      }
    }

    // 2. Extract from document text if available
    let extractionResults: DataExtractionResult | undefined;
    if (documentText) {
      extractionResults = await this.extractDataFromDocument(template, documentText);
      
      // Merge extracted data with auto-populated data
      for (const [fieldName, value] of Object.entries(extractionResults.extracted_fields)) {
        if (!populatedFields[fieldName] && value) {
          populatedFields[fieldName] = value;
          overallConfidence += extractionResults.confidence_scores[fieldName] || 0.5;
          fieldCount++;
        }
      }
    }

    // 3. Use AI to fill remaining fields
    const missingFields = template.fields
      .filter(f => f.required && !populatedFields[f.name])
      .map(f => f.name);

    if (missingFields.length > 0 && (caseData || clientData)) {
      try {
        const aiExtracted = await this.aiAssistedFieldExtraction(
          template,
          missingFields,
          caseData,
          clientData,
          documentText
        );
        
        for (const [fieldName, value] of Object.entries(aiExtracted)) {
          if (value && !populatedFields[fieldName]) {
            populatedFields[fieldName] = value;
            overallConfidence += 0.6; // Medium confidence for AI extraction
            fieldCount++;
          }
        }
      } catch (error) {
        console.error('AI field extraction failed:', error);
      }
    }

    const finalConfidence = fieldCount > 0 ? overallConfidence / fieldCount : 0;
    const stillMissing = template.fields
      .filter(f => f.required && !populatedFields[f.name])
      .map(f => f.name);

    return {
      populated_fields: populatedFields,
      extraction_results: extractionResults,
      confidence_score: finalConfidence,
      missing_required_fields: stillMissing
    };
  }

  /**
   * Extract data from document using AI and OCR
   */
  private async extractDataFromDocument(
    template: FormTemplate,
    documentText: string
  ): Promise<DataExtractionResult> {
    try {
      const fieldDescriptions = template.fields.map(f => 
        `${f.name}: ${f.label} (${f.type}) - ${f.help_text || ''}`
      ).join('\n');

      const extractionPrompt = `Extract form field data from this document:

Form fields needed:
${fieldDescriptions}

Document text:
${documentText.substring(0, 4000)}

Return a JSON object with field names as keys and extracted values. 
Also indicate confidence level for each field (0-1).
Only extract data that clearly matches the field requirements.`;

      const extractionResult = await aiService.generateDraft(
        extractionPrompt,
        'You are extracting structured data from legal documents. Be precise and only extract clear matches.'
      );

      // Parse AI response (simplified)
      try {
        const parsed = JSON.parse(extractionResult);
        const extractedFields = parsed.fields || {};
        const confidenceScores = parsed.confidence || {};
        
        return {
          extracted_fields: extractedFields,
          confidence_scores: confidenceScores,
          missing_fields: template.fields
            .filter(f => f.required && !extractedFields[f.name])
            .map(f => f.name),
          validation_warnings: [],
          source_document: 'AI extraction from document text'
        };
      } catch (parseError) {
        // Fallback if JSON parsing fails
        return {
          extracted_fields: {},
          confidence_scores: {},
          missing_fields: template.fields.filter(f => f.required).map(f => f.name),
          validation_warnings: ['Unable to parse extraction results'],
          source_document: documentText.substring(0, 100) + '...'
        };
      }

    } catch (error) {
      console.error('Document data extraction failed:', error);
      return {
        extracted_fields: {},
        confidence_scores: {},
        missing_fields: template.fields.filter(f => f.required).map(f => f.name),
        validation_warnings: ['Document extraction failed'],
        source_document: 'Error in extraction'
      };
    }
  }

  /**
   * AI-assisted field extraction from case/client data
   */
  private async aiAssistedFieldExtraction(
    template: FormTemplate,
    missingFields: string[],
    caseData: any,
    clientData: any,
    documentText?: string
  ): Promise<Record<string, any>> {
    try {
      const fieldInfo = template.fields
        .filter(f => missingFields.includes(f.name))
        .map(f => `${f.name}: ${f.label} (type: ${f.type}) - ${f.help_text || ''}`)
        .join('\n');

      const extractionPrompt = `Extract values for these form fields from the available data:

Fields needed:
${fieldInfo}

Client data: ${JSON.stringify(clientData)}
Case data: ${JSON.stringify(caseData)}
${documentText ? `Document text: ${documentText.substring(0, 2000)}` : ''}

Return a JSON object with field names as keys and appropriate values.
Use null for fields where no suitable data is found.`;

      const result = await aiService.generateDraft(
        extractionPrompt,
        'You are filling out legal forms with available data. Be accurate and use null for missing data.'
      );

      try {
        return JSON.parse(result) || {};
      } catch {
        return {};
      }

    } catch (error) {
      console.error('AI field extraction failed:', error);
      return {};
    }
  }

  /**
   * Validate form submission
   */
  validateFormSubmission(formId: string, data: Record<string, any>): {
    is_valid: boolean;
    errors: Array<{ field: string; message: string; }>;
    warnings: string[];
  } {
    const template = this.getFormTemplate(formId);
    if (!template) {
      return {
        is_valid: false,
        errors: [{ field: 'form', message: 'Form template not found' }],
        warnings: []
      };
    }

    const errors: Array<{ field: string; message: string; }> = [];
    const warnings: string[] = [];

    // Check validation rules
    for (const rule of template.validation_rules) {
      const fieldValue = data[rule.field];
      
      switch (rule.rule) {
        case 'required':
          if (!fieldValue || fieldValue.toString().trim() === '') {
            errors.push({ field: rule.field, message: rule.message });
          }
          break;
          
        case 'min_length':
          if (fieldValue && fieldValue.toString().length < (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message });
          }
          break;
          
        case 'max_length':
          if (fieldValue && fieldValue.toString().length > (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message });
          }
          break;
          
        case 'pattern':
          if (fieldValue && !new RegExp(rule.value as string).test(fieldValue.toString())) {
            errors.push({ field: rule.field, message: rule.message });
          }
          break;
          
        case 'numeric':
          if (fieldValue && isNaN(Number(fieldValue))) {
            errors.push({ field: rule.field, message: rule.message });
          }
          break;
      }
    }

    // Check field-specific validation
    for (const field of template.fields) {
      const value = data[field.name];
      
      if (field.required && (!value || value.toString().trim() === '')) {
        errors.push({ field: field.name, message: `${field.label} is required` });
      }
      
      if (field.validation && value) {
        if (!new RegExp(field.validation).test(value.toString())) {
          errors.push({ field: field.name, message: `${field.label} format is invalid` });
        }
      }
      
      if (field.max_length && value && value.toString().length > field.max_length) {
        errors.push({ field: field.name, message: `${field.label} is too long (max ${field.max_length} characters)` });
      }
    }

    // Check dependencies
    for (const field of template.fields) {
      if (field.dependency) {
        const dependentValue = data[field.dependency.field];
        const shouldBeRequired = dependentValue === field.dependency.value;
        
        if (shouldBeRequired && (!data[field.name] || data[field.name].toString().trim() === '')) {
          errors.push({ 
            field: field.name, 
            message: `${field.label} is required when ${field.dependency.field} is ${field.dependency.value}` 
          });
        }
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate completed form document
   */
  async generateCompletedForm(
    formId: string,
    data: Record<string, any>,
    outputFormat: 'pdf' | 'html' | 'json' = 'html'
  ): Promise<{
    content: string;
    form_reference: string;
    completion_date: string;
    summary: string;
  }> {
    const template = this.getFormTemplate(formId);
    if (!template) {
      throw new Error(`Form template ${formId} not found`);
    }

    const formReference = `${template.id.toUpperCase()}-${Date.now()}`;
    const completionDate = format(new Date(), 'dd MMMM yyyy');

    try {
      // Use AI to generate a properly formatted form
      const formContent = await aiService.generateDraft(
        `Generate a completed ${template.name} form with this data:
         
         Form: ${template.description}
         Data: ${JSON.stringify(data)}
         
         Format as a professional legal form suitable for submission.
         Include all provided data in the correct sections.
         Add appropriate legal formatting and references.`,
        'You are generating official legal forms. Use proper formatting and legal language.'
      );

      let content: string;
      
      if (outputFormat === 'html') {
        content = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${template.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .form-header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .field-label { font-weight: bold; }
            .field-value { margin-left: 20px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="form-header">
            <h1>${template.name}</h1>
            <p>Reference: ${formReference}</p>
            <p>Completed: ${completionDate}</p>
          </div>
          <div class="form-content">
            ${formContent}
          </div>
        </body>
        </html>
        `;
      } else if (outputFormat === 'json') {
        content = JSON.stringify({
          form_id: formId,
          form_name: template.name,
          reference: formReference,
          completion_date: completionDate,
          data: data,
          sections: template.sections
        }, null, 2);
      } else {
        content = formContent; // Plain text for PDF generation
      }

      const summary = `${template.name} completed with ${Object.keys(data).length} fields populated. Ready for submission via ${template.submission_method}.`;

      return {
        content,
        form_reference: formReference,
        completion_date: completionDate,
        summary
      };

    } catch (error) {
      console.error('Form generation failed:', error);
      
      // Fallback: generate basic form
      const basicContent = this.generateBasicForm(template, data, formReference, completionDate);
      
      return {
        content: basicContent,
        form_reference: formReference,
        completion_date: completionDate,
        summary: `${template.name} generated with basic formatting - AI enhancement failed`
      };
    }
  }

  /**
   * Track form submission status
   */
  async submitForm(
    formId: string,
    data: Record<string, any>,
    submissionMethod?: string
  ): Promise<FormSubmission> {
    const template = this.getFormTemplate(formId);
    if (!template) {
      throw new Error(`Form template ${formId} not found`);
    }

    const validation = this.validateFormSubmission(formId, data);
    if (!validation.is_valid) {
      throw new Error(`Form validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const submission: FormSubmission = {
      id: `sub_${Date.now()}`,
      form_id: formId,
      data,
      status: 'validated',
      validation_errors: [],
      metadata: {
        created_at: new Date(),
        updated_at: new Date(),
        submitted_by: 'system', // Would be actual user
        auto_populated_fields: []
      }
    };

    // Simulate submission based on method
    const method = submissionMethod || template.submission_method;
    
    if (method === 'online') {
      // Would integrate with actual online submission system
      submission.status = 'submitted';
      submission.submission_date = new Date();
      submission.reference_number = `ONL${Date.now()}`;
    } else {
      // For post/email submissions, status remains 'validated' until manual submission
      submission.status = 'validated';
    }

    return submission;
  }

  /**
   * Helper methods
   */
  private extractFieldValue(path: string, clientData: any, caseData: any): any {
    const [source, field] = path.split('.');
    const sourceData = source === 'client' ? clientData : caseData;
    
    if (!sourceData || !field) return null;
    
    return sourceData[field] || null;
  }

  private generateBasicForm(
    template: FormTemplate,
    data: Record<string, any>,
    reference: string,
    date: string
  ): string {
    let html = `
    <h1>${template.name}</h1>
    <p><strong>Reference:</strong> ${reference}</p>
    <p><strong>Date:</strong> ${date}</p>
    <hr>
    `;

    for (const section of template.sections.sort((a, b) => a.order - b.order)) {
      html += `<h2>${section.title}</h2>`;
      
      const sectionFields = template.fields.filter(f => f.section === section.id);
      
      for (const field of sectionFields) {
        const value = data[field.name] || '[Not provided]';
        html += `<p><strong>${field.label}:</strong> ${value}</p>`;
      }
      
      html += '<br>';
    }

    return html;
  }

  /**
   * Get form submission statistics
   */
  getFormStatistics(formId: string): {
    total_submissions: number;
    success_rate: number;
    average_completion_time: string;
    common_errors: Array<{ field: string; error: string; count: number; }>;
  } {
    // Would query actual database in production
    return {
      total_submissions: 0,
      success_rate: 0.95,
      average_completion_time: '15 minutes',
      common_errors: [
        { field: 'postcode', error: 'Invalid format', count: 5 },
        { field: 'claim_amount', error: 'Not numeric', count: 3 }
      ]
    };
  }
}

// Create singleton instance
export const formAutomationService = new FormAutomationService();