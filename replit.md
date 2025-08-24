# Overview

CreativeSpace is a creative writing platform built with React and Express that provides a safe publishing environment for writers to share stories, poems, and fanfiction. The application features a modern, responsive design with user authentication through Replit's OAuth system and a rich text editor for content creation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Runtime**: Node.js with Express framework
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit's OpenID Connect (OIDC) integration with Passport.js
- **Session Management**: Express sessions stored in PostgreSQL using connect-pg-simple

## Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon Database
- **Schema Management**: Drizzle Kit for migrations and schema changes
- **Session Storage**: Database-backed sessions for persistent authentication
- **File Storage**: External image URLs for cover images and profile pictures

## Authentication and Authorization
- **Provider**: Replit OAuth using OpenID Connect standard
- **Session Strategy**: Server-side sessions with secure HTTP-only cookies
- **User Management**: Automatic user creation/update on successful authentication
- **Route Protection**: Middleware-based authentication checks for protected endpoints

## Content Management System
- **Rich Text Editor**: Custom HTML-based editor with formatting toolbar
- **Draft System**: Auto-save functionality for work-in-progress content
- **Publishing Workflow**: Draft-to-published story promotion with metadata
- **Content Types**: Support for stories, poems, and fanfiction categories

## API Design
- **Architecture**: RESTful API with consistent endpoint patterns
- **Error Handling**: Centralized error middleware with structured responses
- **Request Validation**: Zod schemas for input validation and type safety
- **Response Format**: JSON responses with standardized error structures

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Database Client**: @neondatabase/serverless for optimized serverless connections

## Authentication Services
- **Replit OIDC**: OAuth provider for user authentication and authorization
- **OpenID Client**: openid-client library for OAuth flow implementation

## UI and Styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Google Fonts**: Inter and Playfair Display fonts for typography

## Development Tools
- **TypeScript**: Static type checking for both frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment integration and deployment