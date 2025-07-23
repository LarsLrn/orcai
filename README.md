# Sokrates^t^ - AI-Assisted Educational Platform

Sokrates^t^ is a research-oriented educational platform developed by Rhine-Waal University that facilitates AI-assisted Socratic dialogue for educational purposes. The platform enables students to engage in interactive conversations with an AI tutor that uses course materials uploaded by instructors to provide contextually relevant learning support.

## About the Project

Sokrates^t^ is designed to enhance the learning experience through AI-powered conversations that help students explore and understand their course material. The platform implements a Retrieval-Augmented Generation (RAG) approach, where course documents are processed and stored in a vector database to inform AI responses with relevant educational content.

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
- **MinIO** - S3-compatible object storage
- **SpiceDB** - Authorization system
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
- MinIO or S3-compatible storage

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
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sokratest
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# Add other required environment variables
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
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
- `npm run spice:deploy-schema` - Deploy SpiceDB schema

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
- Role-based access control with SpiceDB
- Secure password hashing with Better Auth
- No third-party AI services - self-hosted models only

## Research Context

Sokrates^t^ is currently in a research and testing phase, restricted to invited participants at Rhine-Waal University. The platform is designed to:

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

Sokrates^t^ is an Applied Project of KI:edu.nrw and currently in closed access at Rhine-Waal University.

**Project Links:**
- [About Sokrates^t^](https://www.hochschule-rhein-waal.de/de/fakultaeten/kommunikation-und-umwelt/forschungsprojekte/sokratest)
- [About KI:edu.nrw](https://ki-edu-nrw.ruhr-uni-bochum.de/ueber-das-projekt/phase-2/praxis-transferprojekte/aktuelle-praxisprojekte/#sokratest)

**Supported by:**
- KI:edu.nrw (Artificial Intelligence in Education Initiative North Rhine-Westphalia)
- DH.nrw (Digitalization and Education in Higher Education North Rhine-Westphalia)
- MKW NRW (Ministry of Culture and Science of North Rhine-Westphalia)

This project is funded as part of the KI:edu.nrw initiative, which promotes the integration of artificial intelligence in education across North Rhine-Westphalia's higher education institutions.
