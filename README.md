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
- **Trigger.dev** - Background job processing
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
8. **Trigger.dev**: Background job processing

#### Email Service
9. **SMTP Server**: For sending invitations and notifications

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd sokratest-v2
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (copy `.env.example` to `.env` and configure):
```bash
# Authentication & Security
BETTER_AUTH_SECRET=your_long_random_secret_key
BETTER_AUTH_URL=http://localhost:3000
ENCRYPTION_KEY=your_32_character_encryption_key

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=sokratest-v2
POSTGRES_HOST=localhost
POSTGRES_SSL=false

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USERNAME=user
SMTP_PASSWORD=pw

# S3-Compatible Object Storage
S3_ENDPOINT=https://your-storage-endpoint.com/storage/v1/s3
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_USE_SSL=true

# Application Base URL
VITE_BASE_URL=http://localhost:3000

# Background Jobs (Trigger.dev)
TRIGGER_SECRET_KEY=your_trigger_dev_secret_key
TRIGGER_API_URL=https://your-trigger-instance.com

# AI Services (OpenAI-compatible API)
OPENAI_COMPATIBLE_BASE_URL=https://your-ai-provider.com/v1
OPENAI_COMPATIBLE_API_KEY=your_ai_api_key

# LLM Observability (Langfuse)
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_BASEURL=https://your-langfuse-instance.com

# Vector Database (Qdrant)
QDRANT_URL=https://your-qdrant-instance.com/
QDRANT_API_KEY=your_qdrant_api_key

# Analytics (Umami) - VITE_ prefix exposes to client
VITE_UMAMI_SCRIPT_URL=https://your-umami-instance.com/script.js
VITE_UMAMI_WEBSITE_ID=your_website_id
```

4. Initialize the database schema:
```bash
npm run db:generate
npm run db:migrate
```

5. Seed the database with initial data (optional):
```bash
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Docker Compose Setup (Recommended for Development)

For easier local development, you can use Docker Compose to set up the required services:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sokratest-v2
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  langfuse:
    image: langfuse/langfuse:latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/langfuse
      NEXTAUTH_SECRET: your_secret
      SALT: your_salt
    ports:
      - "3001:3000"
    depends_on:
      - postgres

  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/umami
      HASH_SALT: your_hash_salt
    ports:
      - "3002:3000"
    depends_on:
      - postgres

volumes:
  postgres_data:
  qdrant_data:
  minio_data:
```

Start the services with:
```bash
docker-compose up -d
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio
- `npm run db:seed` - Seed the database
- `npm run format` - Format code with Biome
- `npm run trigger:dev` - Start Trigger.dev development

## Architecture

### Data Flow
1. **Document Upload**: Instructors upload course materials
2. **Processing Pipeline**: Documents are processed through Trigger.dev jobs for text/image extraction
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
