# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to [security contact]. Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

You can expect:
- Acknowledgment within 24 hours
- Initial assessment within 72 hours  
- Regular updates on progress
- Credit for responsible disclosure (if desired)

## Security Considerations

This application handles sensitive legal data. Please consider:

- **PII Protection**: Never include personal identifiable information in issues, PRs, or logs
- **Authentication**: All API endpoints require proper JWT authentication
- **Data Encryption**: Sensitive data is encrypted at rest and in transit
- **Access Control**: Role-based permissions restrict data access
- **Audit Logging**: All sensitive operations are logged for compliance

## Legal Data Handling

- Client data must never appear in code examples
- Test data should use clearly fictional information
- Database backups contain sensitive information
- File uploads are scanned and validated
