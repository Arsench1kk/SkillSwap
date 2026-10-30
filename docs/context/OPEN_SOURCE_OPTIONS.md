# SkillSwap Open Source Options

## Decision rule

Reuse mature infrastructure where it reduces risk. Do not import a large framework just because it is open source. For every dependency, check license, maintenance activity, security history, data handling and whether it can be removed without rewriting the domain.

## Recommended shortlist

| Need | Option | Use in SkillSwap | Decision |
|---|---|---|---|
| Web app | Next.js App Router | Private pilot UI and thin server endpoints | Good default if the team is comfortable with TypeScript. Official docs: https://nextjs.org/docs/app |
| Database | PostgreSQL | Source of truth for participants, requests, matches, sessions and events | Use directly; do not introduce a separate database for MVP. |
| Backend platform | Supabase | Hosted or self-hosted Postgres, Auth, Storage and local development | Consider after concierge validation. Keep SQL and domain code portable. Docs: https://supabase.com/docs/guides/self-hosting |
| Search | PostgreSQL FTS/trigram | Search skills and task text in the first app | Start here before Meilisearch or vectors. |
| Vector similarity | pgvector | Later experiment comparing embedding matching with rules-based matching | Optional; only after labelled match decisions exist. Repo: https://github.com/pgvector/pgvector |
| Identity | Supabase Auth or Keycloak | Student sign-in and operator roles | Supabase is simpler; Keycloak is heavier but useful for self-hosted OIDC. Docs: https://www.keycloak.org/documentation |
| Cache and jobs | Redis | Later rate limits, short-lived state and background jobs | Do not add it for the manual pilot. Docs: https://redis.io/docs/latest/get-started/ |
| Search engine | Meilisearch | Only if PostgreSQL search becomes insufficient | It is open source and easy to deploy, but it is another operational dependency. Docs: https://www.meilisearch.com/open-source |
| Video | Jitsi Meet | Possible self-hosted video later | Use Google Meet or an existing service first; self-hosting video adds operations. Docs: https://jitsi.github.io/handbook/ |
| Observability | OpenTelemetry | Traces, metrics and logs across the app and adapters | Add event names and correlation IDs early. Docs: https://opentelemetry.io/docs/ |
| Local environment | Docker Compose | Reproducible Postgres/Supabase and test services | Use before considering Kubernetes. |

## What not to reuse blindly

- An AI matching platform before the team has labelled match outcomes.
- A complete marketplace template with unknown moderation, privacy and payment behaviour.
- A vector database when PostgreSQL rules and text search are enough.
- A video-conferencing stack when the first users can use Google Meet.
- A payment plugin before the team has evidence that free barter creates useful sessions.
- A workflow tool that hides the event history needed for A6 decisions.

## Suggested implementation sequence

1. Manual forms and sheets, with an exportable event schema.
2. PostgreSQL schema and a small internal operations dashboard.
3. Rules-based matching and transparent reason codes.
4. Authentication and role permissions.
5. Structured feedback and guardrail reporting.
6. Only then compare PostgreSQL text search, pgvector or Meilisearch.

## License and supply-chain checklist

For every package or repository:

- record name, version, repository URL and license;
- check transitive dependencies;
- check whether commercial use is permitted;
- pin versions and use lockfiles;
- run dependency and container vulnerability scans;
- define an update owner;
- avoid copying code without preserving license notices;
- keep an ADR explaining why the dependency exists.

## Current external references

- Next.js App Router: https://nextjs.org/docs/app
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- pgvector: https://github.com/pgvector/pgvector
- OpenTelemetry: https://opentelemetry.io/docs/
- Redis Open Source: https://redis.io/docs/latest/operate/oss_and_stack/
- Jitsi self-hosting: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker/
- Keycloak: https://www.keycloak.org/documentation
- Meilisearch: https://www.meilisearch.com/open-source

