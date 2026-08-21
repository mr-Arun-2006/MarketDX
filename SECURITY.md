# Security Policy

## Security controls

MarketDX uses environment-based configuration for secrets, JWT authentication, bcrypt password hashing, API validation, and automated backend tests.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability. Report it privately to the repository owner through GitHub's private security reporting mechanism when available.

## Development requirements

- Never commit `.env` files, API keys, passwords, private keys, or production credentials.
- Use strong, unique production secrets instead of development defaults.
- Validate external inputs before processing them.
- Run the backend test suite before merging changes.
- Review AI-generated code for correctness, security, and unintended behavior before deployment.
