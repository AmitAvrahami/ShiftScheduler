---
name: software-architect
description: Use this skill for software architecture tasks including system design, architectural patterns (microservices, monolithic, event-driven, serverless), technology evaluation and selection, scalability planning, security architecture, performance optimization, database architecture, API design, cloud architecture, technical decision-making, architecture documentation (ADRs, C4 model), risk assessment, and technical leadership. Applies to enterprise architecture, solution architecture, and system design across all technology stacks and domains.
---

# Software Architect Skill

A comprehensive skill for software architecture covering system design, technical leadership, and strategic decision-making across all technology stacks.

## When to Use This Skill

Use this skill whenever the user needs help with:

- **System Design**: High-level architecture, component design, system boundaries, integration patterns
- **Architectural Patterns**: Choosing between monolithic, microservices, event-driven, layered, hexagonal, CQRS, etc.
- **Technology Selection**: Evaluating technologies, frameworks, databases, cloud providers, tools
- **Scalability & Performance**: Designing for high load, horizontal/vertical scaling, caching strategies, optimization
- **Security Architecture**: Threat modeling, defense in depth, zero trust, compliance (GDPR, HIPAA, SOC2)
- **Database Architecture**: Data modeling, sharding, replication, backup/recovery, migration strategies
- **Cloud Architecture**: Multi-cloud, hybrid cloud, cloud-native design, serverless, containers
- **Integration Architecture**: API design, messaging patterns, event streaming, service mesh
- **Architecture Documentation**: ADRs (Architecture Decision Records), C4 model, technical diagrams
- **Technical Leadership**: Guiding development teams, architecture reviews, mentoring, governance
- **Risk Management**: Identifying technical risks, mitigation strategies, trade-off analysis
- **Legacy Modernization**: Strangler pattern, breaking monoliths, refactoring strategies

## Core Architecture Principles

### 1. Fundamental Architectural Qualities

**Scalability**
- Ability to handle growing load by adding resources
- Horizontal scaling (add more instances) vs. Vertical scaling (bigger machines)
- Consider stateless design for easier horizontal scaling
- Plan for 10x growth, design for 100x

**Reliability**
- System continues working correctly even when things fail
- Fault tolerance: system handles failures gracefully
- Error budget: acceptable failure rate
- Mean Time Between Failures (MTBF) and Mean Time To Recovery (MTTR)

**Availability**
- Percentage of time system is operational
- 99.9% = 8.76 hours downtime/year
- 99.99% = 52.6 minutes downtime/year
- 99.999% (five nines) = 5.26 minutes downtime/year
- Achieved through redundancy, failover, monitoring

**Performance**
- Response time: how fast system responds to requests
- Throughput: how many requests system can handle
- Latency: time taken for data to travel
- Resource utilization: efficient use of CPU, memory, network

**Maintainability**
- How easy is it to modify, extend, and fix the system?
- Clear documentation, clean code, good test coverage
- Separation of concerns, loose coupling
- Technical debt management

**Security**
- Protecting against unauthorized access and attacks
- Secure by design, not an afterthought
- Defense in depth: multiple layers of security
- Principle of least privilege

**Observability**
- Ability to understand system state from external outputs
- Logging, metrics, tracing, alerting
- Debugging and troubleshooting capabilities
- Real-time monitoring and dashboards

### 2. Key Architectural Principles

**Separation of Concerns**
- Divide system into distinct sections, each addressing a separate concern
- Reduces complexity, improves maintainability
- Examples: layered architecture, microservices

**Single Responsibility**
- Each component should have one reason to change
- Applies to services, modules, classes, functions
- Leads to more focused, cohesive components

**Loose Coupling**
- Components depend on abstractions, not concrete implementations
- Changes in one component minimally affect others
- Use interfaces, events, message queues

**High Cohesion**
- Related functionality stays together
- Each module/service focused on specific business capability
- Reduces dependencies between modules

**DRY (Don't Repeat Yourself)**
- Avoid duplication of logic
- Share common functionality through libraries/services
- Balance with service autonomy in distributed systems

**YAGNI (You Aren't Gonna Need It)**
- Don't build features/infrastructure you don't need yet
- Add complexity only when there's clear need
- Balance with planning for known future requirements

**Fail Fast**
- Detect problems early and report them immediately
- Better to crash than corrupt data
- Use validation, assertions, circuit breakers

**Design for Failure**
- Assume components will fail
- Build redundancy, retries, fallbacks
- Graceful degradation when services are unavailable

## Architectural Patterns

### Monolithic Architecture

**Characteristics:**
- Single deployable unit
- All components in one codebase
- Shared database
- In-process communication

**When to Use:**
- Small to medium applications
- Early-stage products (MVP)
- Simple business domain
- Small team

**Advantages:**
- Simple to develop, test, and deploy
- Easier debugging (single process)
- No network latency between components
- Transactions are straightforward

**Disadvantages:**
- Scaling requires scaling entire application
- Long-term maintenance challenges
- Technology stack locked in
- Deployment risks (entire app)
- Team coordination issues as it grows

### Microservices Architecture

**Characteristics:**
- System divided into small, independent services
- Each service owns its data
- Services communicate via APIs or messages
- Independently deployable

**When to Use:**
- Large, complex applications
- Multiple teams working independently
- Need for service-specific scaling
- Polyglot requirements (different tech stacks)

**Advantages:**
- Independent scaling of services
- Technology flexibility per service
- Faster deployments (small changes)
- Team autonomy
- Fault isolation

**Disadvantages:**
- Increased complexity (distributed systems)
- Network latency between services
- Data consistency challenges
- More difficult testing and debugging
- Operational overhead

**Microservices Best Practices:**
- Design around business capabilities
- Decentralize data management (database per service)
- Smart endpoints, dumb pipes
- Infrastructure automation essential
- Design for failure
- Use API gateway for external clients
- Implement circuit breakers and retry logic

### Event-Driven Architecture

**Characteristics:**
- Components communicate through events
- Asynchronous, loosely coupled
- Event producers and consumers are independent
- Events stored in event log/stream

**When to Use:**
- Real-time processing requirements
- Need for high scalability
- Complex event processing
- Integration of heterogeneous systems

**Patterns:**
- **Event Notification**: Simple notification that something happened
- **Event-Carried State Transfer**: Event contains complete state
- **Event Sourcing**: Store all changes as sequence of events
- **CQRS**: Separate read and write models

**Components:**
- Event producers (publishers)
- Event bus/broker (Kafka, RabbitMQ, AWS EventBridge)
- Event consumers (subscribers)
- Event store (optional, for event sourcing)

**Advantages:**
- High scalability and throughput
- Loose coupling between services
- Easy to add new consumers
- Natural audit trail (event log)

**Disadvantages:**
- Eventual consistency
- More complex debugging (distributed traces)
- Message ordering challenges
- Error handling complexity

### Layered (N-Tier) Architecture

**Typical Layers:**
1. **Presentation Layer**: UI, API endpoints
2. **Application/Business Logic Layer**: Core business rules
3. **Data Access Layer**: Database operations
4. **Database Layer**: Actual data storage

**Rules:**
- Each layer can only call the layer directly below it
- No skipping layers
- Dependencies point downward

**Advantages:**
- Clear separation of concerns
- Easy to understand and maintain
- Testable (can mock lower layers)
- Industry standard pattern

**Disadvantages:**
- Can become monolithic
- Performance overhead (multiple layers)
- Changes may ripple through layers

### Hexagonal (Ports and Adapters) Architecture

**Core Concept:**
- Business logic at center (hexagon)
- External concerns (UI, database, APIs) on outside
- Communication through ports (interfaces) and adapters (implementations)

**Benefits:**
- Business logic independent of external concerns
- Easy to swap implementations (different database, API)
- Highly testable (mock adapters)
- Technology agnostic core

### Serverless Architecture

**Characteristics:**
- No server management
- Event-driven, triggered by events
- Auto-scaling
- Pay per execution

**Use Cases:**
- Infrequent or unpredictable workloads
- Background jobs
- API backends
- Data processing pipelines

**Advantages:**
- No infrastructure management
- Automatic scaling
- Cost effective for variable load
- Fast deployment

**Disadvantages:**
- Cold start latency
- Vendor lock-in
- Debugging challenges
- State management complexity
- Execution time limits

### Service-Oriented Architecture (SOA)

**Characteristics:**
- Coarse-grained services
- Enterprise service bus (ESB) for communication
- Shared databases common
- SOAP/XML often used

**Difference from Microservices:**
- Larger services (not as fine-grained)
- Centralized ESB (vs. decentralized communication)
- More governance and standards

## System Design Process

### 1. Requirements Gathering

**Functional Requirements:**
- What should the system do?
- User stories, use cases
- Business rules and workflows

**Non-Functional Requirements:**
- Performance targets (latency, throughput)
- Scalability needs (users, data, requests)
- Availability requirements (SLA)
- Security and compliance requirements
- Data retention and backup policies
- Budget and resource constraints

**Constraints:**
- Technology stack restrictions
- Team skills and size
- Timeline
- Regulatory compliance
- Integration requirements

### 2. Capacity Planning

**Estimate Load:**
- Number of users (daily active, concurrent)
- Requests per second (average, peak)
- Data volume (storage, growth rate)
- Network bandwidth requirements

**Calculate Resources:**
- Compute capacity (CPU, memory)
- Storage needs (database, file storage)
- Network capacity
- Cost projection

**Plan for Growth:**
- 3x current load (short term)
- 10x current load (medium term)
- 100x current load (long term vision)

### 3. High-Level Design

**Components:**
- Identify major components/services
- Define responsibilities
- Determine boundaries
- Consider reusability

**Data Flow:**
- How data moves through system
- Request/response patterns
- Asynchronous processing flows
- Data transformations

**Integration Points:**
- External APIs
- Third-party services
- Legacy systems
- Partner integrations

### 4. Detailed Design

**Component Design:**
- Internal structure
- Interfaces and contracts
- Data models
- Algorithms and business logic

**Data Design:**
- Database schema
- Data partitioning strategy
- Caching layers
- Data access patterns

**Communication Design:**
- Synchronous (REST, GraphQL, gRPC)
- Asynchronous (message queues, events)
- Protocols and formats
- Error handling and retries

### 5. Technology Selection

**Evaluation Criteria:**
- Fits requirements (functional, non-functional)
- Team expertise
- Community support and maturity
- Performance characteristics
- Licensing and cost
- Vendor lock-in risk
- Integration capabilities
- Long-term viability

**Proof of Concept (PoC):**
- Test critical assumptions
- Validate technology choices
- Identify potential issues early
- Build confidence before full commitment

## Database Architecture

### Database Selection

**Relational Databases (SQL)**
- **Use When**: Complex queries, transactions, strong consistency, structured data
- **Examples**: PostgreSQL, MySQL, Oracle, SQL Server
- **Strengths**: ACID transactions, mature tooling, strong consistency, complex joins
- **Limitations**: Vertical scaling limits, rigid schema

**NoSQL Databases**

**Document Stores** (MongoDB, CouchDB)
- Flexible schema
- Nested data structures
- Good for content management, catalogs

**Key-Value Stores** (Redis, DynamoDB)
- Extremely fast
- Simple data model
- Caching, session storage, real-time data

**Column-Family** (Cassandra, HBase)
- Wide column storage
- Time-series data, analytics
- High write throughput

**Graph Databases** (Neo4j, Amazon Neptune)
- Relationships as first-class citizens
- Social networks, recommendation engines
- Complex relationship queries

### Database Design Patterns

**Sharding (Horizontal Partitioning)**
- Split data across multiple databases
- Each shard contains subset of data
- Improves scalability and performance
- Sharding strategies: range-based, hash-based, geographic

**Replication**
- **Primary-Replica**: One primary (writes), multiple replicas (reads)
- **Multi-Primary**: Multiple nodes accept writes (conflict resolution needed)
- **Benefits**: High availability, read scalability, disaster recovery

**Caching Strategy**

**Cache-Aside (Lazy Loading)**
```
1. Check cache
2. If miss, query database
3. Store result in cache
4. Return result
```

**Write-Through**
```
1. Write to cache
2. Write to database
3. Return success
```

**Write-Behind**
```
1. Write to cache
2. Async write to database (batched)
3. Return success immediately
```

**Caching Layers:**
- **Application Cache**: In-memory (local to instance)
- **Distributed Cache**: Redis, Memcached (shared across instances)
- **CDN**: Static assets, API responses (edge caching)
- **Database Query Cache**: Built-in DB caching

### Data Consistency Models

**Strong Consistency**
- All reads see most recent write
- Higher latency
- Use when: Financial transactions, inventory management

**Eventual Consistency**
- Reads may see stale data temporarily
- Lower latency, higher availability
- Use when: Social media feeds, product reviews

**Causal Consistency**
- Related operations maintain order
- Balance between strong and eventual

## Scalability Patterns

### Horizontal Scaling (Scale Out)

**Stateless Services:**
- No local state stored on instances
- Any instance can handle any request
- Easy to add/remove instances
- Load balancer distributes traffic

**Sticky Sessions (if state required):**
- Load balancer routes user to same instance
- Not ideal (limits flexibility)
- Better to externalize state (Redis, database)

**Load Balancing Strategies:**
- **Round Robin**: Distribute requests evenly
- **Least Connections**: Send to instance with fewest connections
- **IP Hash**: Same client always goes to same server
- **Weighted**: Distribute based on instance capacity

### Vertical Scaling (Scale Up)

**Approach:**
- Increase resources of existing machine (CPU, RAM)
- Simpler than horizontal scaling
- Hardware limits eventually

**When to Use:**
- Quick fix for performance issues
- Legacy applications that can't scale horizontally
- Initial growth phase
- Cost-effective for small to medium load

### Caching Strategies

**Application-Level Caching:**
- Cache computed results
- Cache database queries
- Cache external API responses
- TTL (Time To Live) for automatic invalidation

**HTTP Caching:**
- Browser cache
- CDN cache
- API gateway cache
- Use HTTP headers (Cache-Control, ETag)

**Database Caching:**
- Query result cache
- Materialized views
- Read replicas

### Asynchronous Processing

**Use Cases:**
- Long-running operations
- Email/notification sending
- Image/video processing
- Report generation
- Batch operations

**Patterns:**
- **Job Queues**: Tasks added to queue, workers process
- **Message Queues**: Decouple producers and consumers
- **Event Streams**: Real-time event processing

**Benefits:**
- Improved response times
- Better resource utilization
- Fault tolerance (retry failed jobs)
- Peak load handling

### Content Delivery Network (CDN)

**Purpose:**
- Distribute static content globally
- Cache content at edge locations
- Reduce latency for users
- Offload origin server

**What to Cache:**
- Static files (images, CSS, JS)
- API responses (with proper cache headers)
- Video streaming
- Download files

## Security Architecture

### Security Principles

**Defense in Depth**
- Multiple layers of security
- If one layer fails, others protect
- Network security, application security, data security

**Principle of Least Privilege**
- Grant minimum permissions needed
- Users, services, applications
- Regularly review and revoke unnecessary access

**Zero Trust**
- Never trust, always verify
- Verify every request
- Micro-segmentation
- Continuous authentication

**Secure by Default**
- Default configuration should be secure
- Require explicit action to reduce security
- Fail closed (deny by default)

### Authentication & Authorization

**Authentication Methods:**
- **Passwords**: Hash with bcrypt/Argon2, enforce complexity
- **Multi-Factor**: Something you know + have + are
- **OAuth 2.0**: Delegated authorization
- **SAML**: Enterprise SSO
- **Biometrics**: Fingerprint, face recognition

**Authorization Models:**
- **RBAC (Role-Based Access Control)**: Assign roles, roles have permissions
- **ABAC (Attribute-Based Access Control)**: Decisions based on attributes
- **ACL (Access Control Lists)**: Permissions per resource

**Token-Based Authentication:**
- **JWT (JSON Web Tokens)**: Stateless, includes claims
- **Opaque Tokens**: Random string, server-side validation
- **Refresh Tokens**: Long-lived tokens to get new access tokens

### Threat Modeling

**STRIDE Framework:**
- **S**poofing: Impersonating another user
- **T**ampering: Modifying data or code
- **R**epudiation: Denying actions
- **I**nformation Disclosure: Exposing sensitive information
- **D**enial of Service: Making system unavailable
- **E**levation of Privilege: Gaining unauthorized access

**Process:**
1. Identify assets (data, services, infrastructure)
2. Create architecture diagrams with trust boundaries
3. Identify threats using STRIDE
4. Rank threats by risk (likelihood × impact)
5. Define mitigations for each threat
6. Validate and test mitigations

### Data Protection

**Encryption:**
- **At Rest**: Encrypt stored data (databases, files, backups)
- **In Transit**: TLS/HTTPS for all communication
- **In Use**: Encrypt in memory (for highly sensitive data)

**Key Management:**
- Use dedicated key management service (AWS KMS, Azure Key Vault)
- Rotate keys regularly
- Separate encryption keys from data
- Hardware security modules (HSM) for critical keys

**Sensitive Data Handling:**
- **PII (Personally Identifiable Information)**: Name, email, address, SSN
- **PCI-DSS**: Credit card data compliance
- **GDPR**: EU privacy regulation
- **HIPAA**: Healthcare data in US
- **Data Minimization**: Collect only necessary data
- **Data Retention**: Delete data when no longer needed
- **Data Anonymization**: Remove identifying information

### API Security

**API Gateway:**
- Single entry point
- Authentication and authorization
- Rate limiting and throttling
- Request validation
- Logging and monitoring

**Security Best Practices:**
- Use HTTPS only
- Validate all inputs
- Implement rate limiting
- Use API keys for identification
- OAuth for user authorization
- Validate JWT signatures
- Implement CORS properly
- Version APIs (don't break clients)
- Log security events

### Network Security

**Firewalls:**
- Control traffic between network zones
- Whitelist approach (deny all, allow specific)

**Network Segmentation:**
- Separate networks for different purposes
- DMZ for public-facing services
- Internal networks for backend services
- Database network isolated

**DDoS Protection:**
- CDN with DDoS mitigation
- Rate limiting at multiple layers
- Auto-scaling to handle spikes
- WAF (Web Application Firewall)

## Performance Optimization

### Performance Metrics

**Latency:**
- P50: 50th percentile (median)
- P95: 95th percentile (most users experience this or better)
- P99: 99th percentile (captures outliers)

**Throughput:**
- Requests per second (RPS)
- Transactions per second (TPS)
- Concurrent users

**Resource Utilization:**
- CPU usage
- Memory usage
- Disk I/O
- Network bandwidth

### Optimization Strategies

**Database Optimization:**
- Add indexes for frequently queried fields
- Optimize query structure (avoid SELECT *, use JOINs efficiently)
- Use connection pooling
- Implement read replicas for read-heavy workloads
- Partition large tables
- Archive old data
- Use appropriate data types
- Denormalize when necessary (trade-off)

**Application Optimization:**
- Reduce unnecessary computations
- Use efficient algorithms and data structures
- Profile and identify bottlenecks
- Lazy load resources
- Batch operations
- Use async processing for long operations
- Implement pagination for large result sets

**Network Optimization:**
- Minimize request size (compression)
- Reduce number of requests (bundling, GraphQL)
- Use HTTP/2 or HTTP/3
- Implement CDN for static content
- Use connection pooling
- Optimize payload size (only send necessary data)

**Caching Strategy:**
- Cache at multiple layers
- Choose appropriate TTL
- Implement cache invalidation strategy
- Use cache warming for critical data
- Monitor cache hit ratio

### Monitoring & Observability

**Golden Signals:**
- **Latency**: How long to serve requests
- **Traffic**: How much demand on system
- **Errors**: Rate of failed requests
- **Saturation**: How full is the system

**Logging:**
- Structured logging (JSON format)
- Include correlation IDs
- Log levels (DEBUG, INFO, WARN, ERROR)
- Centralized logging (ELK, Splunk, CloudWatch)
- Don't log sensitive data

**Metrics:**
- System metrics (CPU, memory, disk)
- Application metrics (request rate, latency, errors)
- Business metrics (signups, transactions, revenue)
- Custom metrics for key operations

**Distributed Tracing:**
- Track requests across services
- Identify bottlenecks in microservices
- Tools: Jaeger, Zipkin, AWS X-Ray, OpenTelemetry

**Alerting:**
- Alert on symptoms, not causes
- Set appropriate thresholds
- Avoid alert fatigue
- Include runbooks with alerts
- On-call rotation

## Cloud Architecture

### Cloud Service Models

**IaaS (Infrastructure as a Service)**
- Virtual machines, storage, networks
- You manage: OS, middleware, runtime, data, applications
- Examples: AWS EC2, Azure VMs, Google Compute Engine

**PaaS (Platform as a Service)**
- Platform provides runtime environment
- You manage: data, applications
- Examples: Heroku, Google App Engine, Azure App Service

**SaaS (Software as a Service)**
- Complete application provided
- You manage: configuration, data
- Examples: Salesforce, Office 365, Gmail

**FaaS (Function as a Service)**
- Serverless compute
- Pay per execution
- Examples: AWS Lambda, Azure Functions, Google Cloud Functions

### Cloud Design Patterns

**Scalability Patterns:**
- Auto-scaling based on metrics
- Load balancing across instances
- Content delivery network (CDN)
- Database read replicas

**Availability Patterns:**
- Multi-region deployment
- Redundancy at every layer
- Health checks and automatic failover
- Backup and disaster recovery

**Data Patterns:**
- Object storage for files (S3, Azure Blob)
- Managed databases (RDS, Cosmos DB)
- Data lakes for analytics
- Data warehouses (Redshift, BigQuery)

**Integration Patterns:**
- API Gateway for external access
- Message queues for async communication
- Event buses for event-driven architecture
- Service mesh for microservices

### Multi-Cloud & Hybrid Cloud

**Multi-Cloud:**
- Use multiple cloud providers
- Avoid vendor lock-in
- Leverage best services from each
- Challenges: Complexity, data transfer costs

**Hybrid Cloud:**
- Combination of on-premises and cloud
- Gradual migration strategy
- Regulatory requirements (data residency)
- Challenges: Network latency, security

**Cloud-Agnostic Design:**
- Abstract cloud-specific services
- Use containers (Docker, Kubernetes)
- Infrastructure as Code (Terraform)
- Avoid proprietary services when possible

## Integration Patterns

### Synchronous Communication

**REST APIs:**
- Resource-based URLs
- HTTP methods (GET, POST, PUT, DELETE)
- Stateless
- Human-readable
- Widespread adoption

**GraphQL:**
- Query language for APIs
- Client specifies exact data needed
- Single endpoint
- Reduces over-fetching and under-fetching
- Strongly typed

**gRPC:**
- Protocol Buffers (binary format)
- Faster than REST
- Bi-directional streaming
- Code generation
- Less human-readable

### Asynchronous Communication

**Message Queues:**
- Point-to-point communication
- Guaranteed delivery
- Load leveling
- Examples: RabbitMQ, Amazon SQS, Azure Service Bus

**Publish-Subscribe (Pub/Sub):**
- One-to-many communication
- Publishers and subscribers decoupled
- Examples: Google Pub/Sub, AWS SNS, Redis Pub/Sub

**Event Streaming:**
- Ordered, replayable events
- High throughput
- Event sourcing
- Examples: Apache Kafka, AWS Kinesis, Azure Event Hubs

### Integration Strategies

**API Gateway:**
- Single entry point for clients
- Request routing
- Authentication and authorization
- Rate limiting
- Request/response transformation

**Service Mesh:**
- Infrastructure layer for service-to-service communication
- Service discovery
- Load balancing
- Circuit breaking
- Observability
- Examples: Istio, Linkerd, Consul

**Saga Pattern:**
- Manage distributed transactions
- Compensating transactions for rollback
- Choreography vs. Orchestration

**Circuit Breaker:**
- Prevent cascading failures
- Stop calling failing service
- Return fallback response
- Periodically retry

**Retry Pattern:**
- Retry failed operations
- Exponential backoff
- Maximum retry limit
- Idempotency important

## Architecture Documentation

### Architecture Decision Records (ADRs)

**Structure:**
```
# ADR-001: [Short title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
What is the issue we're seeing that motivates this decision?
What are the forces at play (constraints, requirements)?

## Decision
What is the change we're proposing/making?

## Consequences
What becomes easier or more difficult as a result?
Positive and negative consequences.

## Alternatives Considered
What other options were evaluated?
Why were they rejected?
```

**Best Practices:**
- One decision per ADR
- Write when decision is made
- Immutable (don't edit, create new ADR)
- Keep in version control
- Review during architecture reviews

### C4 Model for Architecture Diagrams

**Level 1: System Context**
- Highest level view
- System and its users
- External systems it interacts with
- Non-technical audience

**Level 2: Container**
- Major containers (applications, databases, file systems)
- Technology choices
- Communication between containers

**Level 3: Component**
- Components within a container
- Responsibilities
- Internal structure

**Level 4: Code**
- Class diagrams, ER diagrams
- Implementation details
- Usually generated from code

**Diagram Best Practices:**
- Keep it simple
- Use consistent notation
- Add legends
- Show only relevant details for audience
- Use different diagrams for different concerns

### Technical Documentation

**Architecture Overview:**
- High-level system description
- Key design decisions
- Technology stack
- Deployment architecture

**Component Documentation:**
- Purpose and responsibilities
- Interfaces and contracts
- Dependencies
- Configuration

**Operational Documentation:**
- Deployment procedures
- Monitoring and alerting
- Troubleshooting guides
- Disaster recovery procedures
- Runbooks for common issues

## Technical Leadership

### Architecture Governance

**Architecture Review Board:**
- Review significant architecture decisions
- Ensure alignment with standards
- Risk assessment
- Cross-team coordination

**Architecture Principles:**
- Define organization-wide principles
- Guide technology choices
- Enforce consistency
- Examples: API-first, cloud-native, security-first

**Standards and Guidelines:**
- Coding standards
- API design guidelines
- Security requirements
- Performance standards
- Documentation requirements

### Leading Architecture Evolution

**Strangler Pattern:**
- Gradually replace legacy system
- Route new features to new system
- Incrementally migrate functionality
- Eventually "strangle" old system

**Anti-Corruption Layer:**
- Protect new system from legacy complexity
- Translate between systems
- Isolate domains

**Breaking the Monolith:**
1. Identify service boundaries
2. Extract one service at a time
3. Start with least dependencies
4. Use API gateway for routing
5. Gradually decompose

### Mentoring and Knowledge Sharing

**Architecture Reviews:**
- Regular reviews of design proposals
- Provide constructive feedback
- Share expertise
- Validate decisions

**Technical Debt Management:**
- Identify technical debt
- Prioritize debt reduction
- Balance feature development with debt paydown
- Make debt visible to stakeholders

**Knowledge Transfer:**
- Architecture documentation
- Brown bag sessions
- Pair programming/designing
- Code reviews
- Internal tech talks

## Risk Management

### Identifying Risks

**Technical Risks:**
- Technology immaturity
- Scalability concerns
- Security vulnerabilities
- Integration complexity
- Performance issues
- Data loss or corruption

**Organizational Risks:**
- Lack of skills
- Resource constraints
- Timeline pressure
- Changing requirements

**External Risks:**
- Vendor dependency
- Regulatory changes
- Market changes
- Third-party service outages

### Risk Assessment

**Risk Matrix:**
```
Impact vs. Likelihood

High Impact:
  Low Likelihood: Monitor
  Medium Likelihood: Mitigate
  High Likelihood: Avoid or Transfer

Low Impact:
  Low Likelihood: Accept
  Medium Likelihood: Accept or Monitor
  High Likelihood: Mitigate
```

### Risk Mitigation Strategies

**Avoid:**
- Don't do the risky activity
- Choose alternative approach

**Transfer:**
- Insurance
- Outsource to vendor
- Cloud provider responsibility

**Mitigate:**
- Reduce likelihood or impact
- Proof of concept
- Incremental implementation
- Add monitoring

**Accept:**
- Risk is low enough
- Cost of mitigation too high
- Have contingency plan

## Trade-Off Analysis

### Common Trade-Offs

**Consistency vs. Availability (CAP Theorem)**
- Can't have both in presence of network partition
- Choose based on business requirements

**Latency vs. Throughput**
- Optimizing one may hurt the other
- Batching increases throughput but latency

**Simplicity vs. Flexibility**
- Simple solutions easier to maintain
- Flexible solutions more complex but adaptable

**Time to Market vs. Technical Excellence**
- Quick and dirty vs. well-architected
- Short-term vs. long-term thinking

**Cost vs. Performance**
- More resources cost more
- Optimization takes time and effort

**Build vs. Buy**
- Build: Full control, custom fit, maintenance burden
- Buy: Faster, proven, vendor dependency, licensing costs

### Making Architecture Decisions

**Decision Framework:**
1. Understand requirements and constraints
2. Identify options
3. Define evaluation criteria
4. Score each option
5. Consider trade-offs
6. Make decision
7. Document in ADR
8. Validate with stakeholders

**Evaluation Criteria Examples:**
- Meets functional requirements
- Meets non-functional requirements
- Team expertise
- Time to implement
- Cost (initial and ongoing)
- Risk level
- Maintainability
- Flexibility for future
- Industry best practices

## Conclusion

This skill equips Claude to provide expert software architecture guidance across all technology stacks and domains. The focus is on fundamental principles, proven patterns, strategic thinking, and pragmatic decision-making.

**Key Takeaways:**
- Start with requirements, not solutions
- Think in trade-offs, not absolutes
- Design for failure and change
- Scalability and security from day one
- Document key decisions (ADRs)
- Measure and monitor everything
- Balance short-term delivery with long-term maintainability
- Simple is better than clever
- Learn from industry patterns
- Adapt to context, don't dogmatically follow patterns

Software architecture is about making informed trade-offs that balance business needs, technical constraints, team capabilities, and long-term maintainability.
