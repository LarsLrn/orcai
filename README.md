# Sokrates<sup>t</sup> - AI-Assisted Educational Platform

Sokrates<sup>t</sup> is a research-oriented educational platform developed by Rhine-Waal University that facilitates AI-assisted Socratic dialogue for educational purposes. The platform enables students to engage in interactive conversations with an AI tutor that uses course materials uploaded by instructors to provide contextually relevant learning support.

## About the Project

Sokrates<sup>t</sup> is designed to enhance the learning experience through AI-powered conversations that help students explore and understand their course material. The platform implements a Retrieval-Augmented Generation (RAG) approach, where course documents are processed and stored in a vector database to inform AI responses with relevant educational content.

### Key Features

- **AI-Powered Tutoring**: Interactive chat interface with an AI tutor trained on course-specific materials
- **Document Processing**: Automatic processing of course documents (PDFs, Word docs, PowerPoint presentations, images) with text and image extraction
- **Retrieval-Augmented Generation**: AI responses are enhanced with relevant course material through semantic search
- **Multi-language Support**: Internationalization support with German and English locales
- **User Management**: Course-based access control with instructor invitations
- **Rich Text Editor**: TipTap-based editor for enhanced content creation
- **Real-time Analytics**: Self-hosted Umami analytics for usage insights
- **Responsive Design**: Modern UI with dark/light mode support

## Technology Stack

### Frontend
- **React 19** - Modern React with concurrent features
- **TanStack Start** - Full-stack React framework with file-based routing
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **TipTap** - Rich text editor
- **Motion** - Animation library

### Backend
- **TanStack Start** - Server-side rendering and API routes
- **oRPC** - Type-safe RPC framework
- **Better Auth** - Authentication system
- **Drizzle ORM** - Type-safe SQL ORM
- **PostgreSQL** - Primary database
- **Qdrant** - Vector database for semantic search

### AI & Processing
- **AI SDK** - AI model integration
- **Langchain** - Document processing and text splitting
- **Langfuse** - LLM observability and analytics
- **GWDG** - AI model hosting (German infrastructure)

### Infrastructure
- **pg-boss** - Background job processing
- **S3-compatible Storage** - Object storage (MinIO, Supabase Storage, AWS S3)
- **Umami** - Privacy-focused analytics

### Development Tools
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Biome** - Formatting and linting
- **Drizzle Kit** - Database migrations
- **Husky** - Git hooks

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Qdrant vector database
- S3-compatible storage (MinIO, Supabase Storage, AWS S3, etc.)
- SMTP server (for email notifications)

### Required Services Setup

Before running the application, you'll need to set up the following services:

#### Database Services
1. **PostgreSQL**: Main application database
2. **Qdrant**: Vector database for semantic search and embeddings

#### Storage & Infrastructure
3. **S3-compatible Storage**: Object storage for uploaded documents and assets (MinIO, Supabase Storage, AWS S3)
4. **Langfuse**: LLM observability and analytics (self-hosted or cloud)
5. **Umami**: Privacy-focused web analytics (self-hosted)

#### AI Services
6. **OpenAI-compatible API**: For LLM inference (GWDG Academic Cloud or similar)
7. **Docling API**: Document processing service

#### Email Service
8. **SMTP Server**: For sending invitations and notifications

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd sokratest-v2
```

### Dev Container Quickstart (Recommended)

This repository includes a devcontainer setup in `.devcontainer/`.

Prerequisites:
- Docker
- VS Code with the "Dev Containers" extension

Steps:
1. Open the repository in VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Wait for first-time setup (`bun install`) and all services to launch.
4. Start hot-reload development server with `bun run dev`.
5. Open `http://localhost:3000`.

What this starts automatically:
- Local infrastructure services: PostgreSQL, MinIO, Qdrant, SpiceDB
- One-shot initialization services: DB migrations, MinIO bucket setup, SpiceDB migration/schema load
- A Bun-based workspace container with the source code mounted for interactive development

Notes:
- The devcontainer keeps internal service addresses fixed to the Compose network, and uses environment variables from your shell or repo `.env` for credentials and external integrations when present. The default credentials are insecure and only fit for local development. Do not deploy via `docker-compose.dev.yaml`!
- The devcontainer defaults target a local Ollama-compatible API at `http://localhost:11434/v1`. Langfuse remains optional and unset by default. Override these via `.env` if needed.

### Manual Installation (Host Machine)

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (copy `.env.example` to `.env` and configure). See `.env.example` for supported variables.

3. Initialize the database schema:
```bash
npm run db:generate
npm run db:migrate
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Docker Compose Setup (Local App Stack)

If you want to try the full application locally without setting up a deployment or running the app process yourself, start the local Compose stack with:
```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml up -d
```

This starts:
- the `sokratest` app container on `http://localhost:3000`
- PostgreSQL on `localhost:5432`
- MinIO on `localhost:9000` and `localhost:9001`
- Qdrant on `localhost:6333` and `localhost:6334`
- SpiceDB on `localhost:50051`

To stop it again:
```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml down
```

If you instead want to run the app process directly on your host machine, use the manual installation flow above and run `bun run dev`.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio
- `npm run db:seed` - Seed the database
- `npm run format` - Format code with Biome

## Architecture

### Data Flow
1. **Document Upload**: Instructors upload course materials
2. **Processing Pipeline**: Documents are processed through pg-boss jobs for text/image extraction
3. **Vectorization**: Content is converted to embeddings and stored in Qdrant
4. **Chat Interface**: Students interact with AI tutor
5. **RAG Retrieval**: Relevant course material is retrieved based on chat context
6. **AI Response**: Enhanced responses are generated using retrieved content

### Security & Privacy
- All data processing occurs within German infrastructure (GDPR compliant)
- Authentication via university email addresses
- Role-based access control with built-in authorization system
- Secure password hashing with Better Auth
- No third-party AI services - self-hosted models only

## Research Context

Sokrates<sup>t</sup> is currently in a research and testing phase, restricted to invited participants at Rhine-Waal University. The platform is designed to:

- Study the effectiveness of AI-assisted Socratic dialogue in education
- Analyze usage patterns and learning outcomes
- Develop best practices for AI integration in educational settings
- Maintain strict privacy and data protection standards

**Important Note**: This is an experimental platform. Regular backups are not guaranteed during the testing phase, and data loss may occur due to system updates or technical issues.

## Contributing

This is a research project currently in closed access. For questions or collaboration inquiries, please contact the project team at [sokratest@hochschule-rhein-waal.de](mailto:sokratest@hochschule-rhein-waal.de).

## License

This project is part of an ongoing research initiative at Rhine-Waal University. Please refer to the Terms of Use and Privacy Policy for usage guidelines and restrictions.

---

## Funding Notice

Sokrates<sup>t</sup> is an Applied Project of KI:edu.nrw and currently in closed access at Rhine-Waal University.

**Project Links:**
- [About Sokrates<sup>t</sup>](https://www.hochschule-rhein-waal.de/de/fakultaeten/kommunikation-und-umwelt/forschungsprojekte/sokratest)
- [About KI:edu.nrw](https://ki-edu-nrw.ruhr-uni-bochum.de/ueber-das-projekt/phase-2/praxis-transferprojekte/aktuelle-praxisprojekte/#sokratest)

**Supported by:**
- KI:edu.nrw (Artificial Intelligence in Education Initiative North Rhine-Westphalia)
- DH.nrw (Digitalization and Education in Higher Education North Rhine-Westphalia)
- MKW NRW (Ministry of Culture and Science of North Rhine-Westphalia)

This project is funded as part of the KI:edu.nrw initiative, which promotes the integration of artificial intelligence in education across North Rhine-Westphalia's higher education institutions.
