---
name: ux-ui-designer
description: Use this skill for UX/UI design tasks including user research (interviews, surveys, personas), information architecture (sitemaps, user flows), interface design (wireframes, mockups, prototypes), usability testing, design systems, and design-to-development handoff. Trigger when users need help with user experience strategy, visual design, interaction design, accessibility, design critique, or presenting design decisions to stakeholders.
---

# UX/UI Designer Skill

A comprehensive skill for user experience and user interface design, covering the entire design process from research to implementation.

## When to Use This Skill

Use this skill whenever the user needs help with:

- **User Research**: Conducting interviews, designing surveys, creating personas, journey mapping, empathy mapping
- **Information Architecture**: Organizing content, creating sitemaps, card sorting, navigation design, content strategy
- **User Flows**: Mapping user journeys, task flows, decision trees, happy paths and edge cases
- **Wireframing**: Low-fidelity sketches, layout structure, component placement, responsive considerations
- **Visual Design**: UI mockups, design systems, typography, color theory, visual hierarchy, branding
- **Prototyping**: Interactive prototypes, micro-interactions, animation principles, testing prototypes
- **Usability Testing**: Test planning, moderating sessions, analyzing results, iterating based on feedback
- **Accessibility**: WCAG compliance, inclusive design, assistive technology considerations
- **Design Handoff**: Specs, asset export, design system documentation, developer collaboration
- **Design Critique**: Evaluating designs, providing feedback, justifying design decisions

## Core UX Principles

### 1. User-Centered Design

Everything starts and ends with the user:

- **Empathy First**: Understand users' needs, goals, pain points, and context
- **Research-Driven**: Base decisions on data, not assumptions
- **Iterative Process**: Test early, test often, improve continuously
- **Accessibility**: Design for all users, including those with disabilities
- **Context Matters**: Consider device, environment, user state, and circumstances

### 2. Fundamental Design Principles

**Visual Hierarchy**
- Guide users' attention through size, color, contrast, and positioning
- Most important elements should be most prominent
- Use whitespace to create breathing room and focus

**Consistency**
- Maintain consistent patterns throughout the interface
- Reuse components and interactions
- Follow platform conventions (iOS HIG, Material Design, Web standards)

**Feedback & Affordance**
- Provide clear feedback for every user action
- Visual affordances should indicate interactivity
- Show system status and loading states

**Error Prevention & Recovery**
- Design to prevent errors before they happen
- When errors occur, provide clear, helpful messages
- Make it easy to undo or recover

**Cognitive Load**
- Don't make users think unnecessarily
- Chunk information into digestible pieces
- Progressive disclosure: show advanced options only when needed

**Recognition over Recall**
- Make options and actions visible
- Don't rely on users remembering information
- Provide contextual help and tooltips

### 3. Mobile-First & Responsive Design

- Design for smallest screen first, then scale up
- Touch targets minimum 44x44pt (iOS) or 48x48dp (Android)
- Thumb-friendly zones for mobile interactions
- Adapt layouts and information density for different screen sizes
- Consider portrait and landscape orientations

## User Research Methods

### Planning Research

**Define Research Goals:**
- What do you want to learn?
- What decisions will this research inform?
- Who are your target users?
- What's your timeline and budget?

**Choose Appropriate Methods:**
- **Qualitative**: Deep insights, "why" questions (interviews, usability tests)
- **Quantitative**: Statistical data, "how many" questions (surveys, analytics)
- **Behavioral**: What users actually do (observation, A/B testing)
- **Attitudinal**: What users say they do (interviews, surveys)

### User Interviews

**Best Practices:**
- Create interview guide with open-ended questions
- Start broad, then dig deeper with follow-up questions
- Ask about behavior, not hypotheticals ("Tell me about the last time you..." vs "Would you use...?")
- Listen more than you talk (80/20 rule)
- Avoid leading questions
- Record with permission (audio/video)
- Take notes on quotes, emotions, and behaviors
- Aim for 5-8 interviews per user segment

**Sample Interview Structure:**
1. **Introduction** (5 min): Build rapport, explain purpose, get consent
2. **Background** (10 min): Understand context and current behavior
3. **Deep Dive** (30 min): Explore pain points, needs, workflows
4. **Wrap-up** (5 min): Any final thoughts, thank participant

### Surveys

**Design Effective Surveys:**
- Keep it short (5-10 minutes max)
- Start with easy questions
- Use a mix of question types (multiple choice, scales, open-ended)
- Avoid double-barreled questions ("How satisfied are you with the speed and design?")
- Use neutral language, avoid bias
- Include progress indicator
- Make it mobile-friendly
- Test before sending

**Common Scale Types:**
- Likert Scale: "Strongly Disagree" to "Strongly Agree" (5 or 7 points)
- NPS (Net Promoter Score): 0-10 likelihood to recommend
- Semantic Differential: Opposing adjectives on a scale
- Frequency: "Never" to "Always"

### Creating Personas

**Persona Structure:**
```
[Name] - The [Role/Type]

Demographics:
- Age, location, occupation
- Tech savviness
- Device preferences

Goals:
- Primary goals when using the product
- Success criteria

Pain Points:
- Frustrations with current solutions
- Barriers to achieving goals

Behaviors:
- Typical workflows
- Habits and patterns
- Decision-making process

Quote:
"A memorable quote that captures their mindset"
```

**Persona Best Practices:**
- Base on real research data, not stereotypes
- Create 2-4 primary personas (too many dilutes focus)
- Include both goals and pain points
- Make them feel real with names and photos
- Use them in design decisions ("Would Sarah be able to find this?")
- Update as you learn more

### Journey Mapping

**User Journey Map Components:**
1. **Phases**: Stages of the user's journey (Awareness → Research → Purchase → Use → Advocate)
2. **Actions**: What the user does in each phase
3. **Touchpoints**: Where they interact with the product/service
4. **Thoughts**: What they're thinking
5. **Emotions**: How they feel (visualize with an emotion curve)
6. **Pain Points**: Frustrations and obstacles
7. **Opportunities**: Areas for improvement

**Tips:**
- Focus on a specific scenario or task
- Include both digital and non-digital touchpoints
- Identify emotional peaks and valleys
- Highlight moments of truth (critical decision points)
- Use journey maps to align stakeholders on user experience

## Information Architecture

### Card Sorting

**Open Card Sort**: Users group items and create their own category names
- Use early in design to understand mental models
- 30-40 cards works well
- Need 15+ participants for reliable patterns

**Closed Card Sort**: Users group items into predefined categories
- Use to validate proposed structure
- Faster to complete and analyze

### Creating Sitemaps

**Sitemap Best Practices:**
- Start with user tasks, not organizational structure
- Group related content logically
- Limit depth (ideally 3 levels max)
- Use clear, descriptive labels
- Show relationships and connections
- Include notes about special pages (login-required, external links)

**Common Patterns:**
- **Hierarchical**: Tree structure, most common for websites
- **Hub and Spoke**: Central page with links to sections
- **Sequential**: Linear flow (e.g., onboarding, checkout)
- **Matrix**: Multiple entry points and paths

### Navigation Design

**Types of Navigation:**
- **Primary**: Main menu, always visible
- **Secondary**: Sub-navigation, contextual menus
- **Local**: Within a page or section
- **Utility**: Account, settings, help (often top-right)
- **Breadcrumbs**: Show hierarchy and location

**Best Practices:**
- Keep main navigation to 5-7 items
- Use familiar labels (not clever but unclear names)
- Highlight current location
- Make clickable areas large enough
- Support multiple navigation methods (menu, search, related links)

### User Flows

**Flow Diagram Elements:**
- **Start/End**: Oval shapes
- **Actions**: Rectangles
- **Decisions**: Diamonds
- **Inputs**: Parallelograms
- **Arrows**: Show direction and flow

**Creating Effective Flows:**
- Define the user's goal
- Map the happy path first
- Then add edge cases and errors
- Show system responses
- Include decision points and branching
- Keep it at appropriate detail level (not too high-level, not too detailed)
- Use consistent notation

## Wireframing

### Low-Fidelity Wireframes

**Purpose:**
- Explore layout and structure quickly
- Focus on functionality, not aesthetics
- Easy to iterate and throw away
- Facilitate discussion without getting stuck on visual details

**What to Include:**
- Layout and grid structure
- Navigation placement
- Content hierarchy and grouping
- Component placement (buttons, forms, images)
- Annotations for interactions and behavior

**What to Avoid:**
- Real content (use lorem ipsum or placeholders)
- Colors beyond grayscale
- Detailed typography
- Images (use boxes with X)
- Pixel-perfect alignment

### Medium-Fidelity Wireframes

**Purpose:**
- More detailed than sketches, still faster than high-fidelity
- Define component types and interactions
- Good for client presentations and developer handoff

**Includes:**
- Actual component types (buttons, inputs, cards)
- Content hierarchy with varying text sizes
- Realistic content length
- Interaction states (hover, active, disabled)
- Annotations and notes

### Responsive Wireframes

**Considerations:**
- Design for mobile, tablet, and desktop
- Show how layout adapts at different breakpoints
- Consider touch vs. mouse interactions
- Adjust information density
- Reflow or hide/show elements based on screen size

**Common Breakpoints:**
- Mobile: 320-767px
- Tablet: 768-1024px
- Desktop: 1025px+
- Large desktop: 1440px+

## Visual Design (UI)

### Typography

**Type Hierarchy:**
- **Display/H1**: Largest, used sparingly for main headings
- **H2-H6**: Subheadings in descending size
- **Body**: Main content text (16-18px for web)
- **Small**: Captions, footnotes (12-14px)
- **Labels**: Form labels, UI text (14-16px)

**Best Practices:**
- Limit to 2-3 font families per design
- Use weight and size to create hierarchy, not just different fonts
- Line height: 1.5-1.6 for body text, tighter for headings
- Line length: 50-75 characters optimal
- Contrast: minimum 4.5:1 for normal text (WCAG AA)
- Use system fonts for better performance when appropriate

**Popular Font Pairings:**
- Serif + Sans-serif (contrast)
- Different weights of same family (harmony)
- Geometric + Humanist sans-serif (balanced)

### Color Theory

**Color Systems:**
- **Primary**: Main brand color (1-2 colors)
- **Secondary**: Supporting colors for variety
- **Neutral**: Grays for backgrounds, borders, text
- **Semantic**: Success (green), Error (red), Warning (yellow), Info (blue)

**Creating a Palette:**
1. Start with primary brand color
2. Create shades (darker) and tints (lighter) of primary
3. Choose complementary or analogous secondary colors
4. Define neutral grays (6-8 shades)
5. Set semantic colors
6. Test all combinations for contrast

**Color Accessibility:**
- Text contrast: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- Don't rely on color alone to convey information
- Test with color blindness simulators
- Provide patterns or icons in addition to color

**60-30-10 Rule:**
- 60% dominant color (usually neutral background)
- 30% secondary color (content areas, cards)
- 10% accent color (CTAs, highlights)

### Visual Hierarchy

**Techniques:**
- **Size**: Larger elements attract attention first
- **Color**: Bright, saturated colors stand out
- **Contrast**: Light vs. dark, thick vs. thin
- **Position**: Top and left get noticed first (F-pattern)
- **Whitespace**: Isolation draws attention
- **Repetition**: Patterns create unity
- **Alignment**: Creates order and relationships

### Spacing & Layout

**Grid Systems:**
- **Column Grid**: Divide width into columns (12 is common)
- **Baseline Grid**: Align text to horizontal rhythm
- **8pt Grid**: Use multiples of 8 for spacing (8, 16, 24, 32, 40, etc.)

**Spacing Scale:**
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

**Whitespace:**
- Use generous whitespace to create breathing room
- Group related elements with proximity
- Separate unrelated elements with more space
- Whitespace is not wasted space

### UI Components

**Common Components:**
- **Buttons**: Primary, Secondary, Tertiary, Icon buttons
- **Forms**: Inputs, Textareas, Selects, Checkboxes, Radio buttons
- **Cards**: Contained content with related information
- **Modals/Dialogs**: Focus attention on specific task
- **Navigation**: Menus, Tabs, Breadcrumbs, Pagination
- **Feedback**: Toasts, Alerts, Progress indicators, Tooltips
- **Data Display**: Tables, Lists, Chips/Tags

**Button States:**
- Default
- Hover
- Active/Pressed
- Focused (keyboard)
- Disabled
- Loading

### Design Systems

**Design System Components:**
- **Foundation**: Colors, typography, spacing, grid
- **Components**: Reusable UI elements with variants and states
- **Patterns**: Common solutions for recurring problems
- **Guidelines**: Usage rules, best practices, accessibility
- **Assets**: Icons, illustrations, imagery

**Benefits:**
- Consistency across products
- Faster design and development
- Easier maintenance
- Better collaboration
- Scalability

## Prototyping

### Prototype Fidelity Levels

**Low-Fidelity:**
- Paper prototypes or simple click-through wireframes
- Fast to create, easy to iterate
- Good for early concept testing
- Focus on flow and functionality

**Medium-Fidelity:**
- Interactive wireframes with basic transitions
- Test navigation and user flows
- More realistic than paper, faster than high-fidelity

**High-Fidelity:**
- Looks and feels like final product
- Includes interactions, animations, transitions
- Used for final usability testing and stakeholder demos
- Can be time-intensive to create

### Interaction Design

**Micro-interactions:**
- Button hover effects
- Form validation feedback
- Loading animations
- Swipe gestures
- Pull to refresh
- Like/favorite animations

**Animation Principles (12 Principles of Animation):**
- **Timing**: Duration of animations (fast for small, slower for large)
- **Easing**: Acceleration and deceleration (ease-in-out feels natural)
- **Anticipation**: Prepare user for what's coming
- **Follow-through**: Continue motion naturally
- **Staging**: Direct attention to what's important
- **Exaggeration**: Make it noticeable but not distracting

**Animation Guidelines:**
- Keep animations under 300ms for UI feedback
- Use 500-700ms for transitions
- Avoid animations longer than 1 second
- Prefer CSS transitions over JavaScript when possible
- Make animations meaningful, not decorative
- Provide option to reduce motion (accessibility)

### Tools & Techniques

**Prototyping Tools:**
- **Figma**: Web-based, collaborative, component-based
- **Adobe XD**: Integrated with Creative Cloud, voice prototyping
- **Sketch**: Mac-only, plugin ecosystem
- **Framer**: Code-based, advanced animations
- **Principle**: Mac-only, animation-focused
- **ProtoPie**: Complex interactions without code

**Creating Effective Prototypes:**
- Start with key flows, not every screen
- Use real or realistic content
- Include error states and edge cases
- Make clickable areas obvious during testing
- Prepare fallback screens for unexpected paths
- Document prototype limitations

## Usability Testing

### Planning Tests

**Define Test Goals:**
- What do you want to learn?
- What tasks should users complete?
- What's your success criteria?
- How many participants do you need? (5-8 often sufficient for qualitative)

**Recruiting Participants:**
- Match your target users
- Use screener survey to qualify
- Offer appropriate incentive
- Schedule sessions with buffer time
- Plan for no-shows (over-recruit by 20%)

### Test Structure

**Typical Session (60 minutes):**
1. **Welcome** (5 min): Build rapport, explain process, get consent
2. **Pre-test Questions** (5 min): Background, current behavior
3. **Tasks** (35 min): 3-5 tasks with thinking aloud
4. **Post-test Questions** (10 min): Overall impressions, SUS survey
5. **Wrap-up** (5 min): Thank participant, incentive

**Writing Task Scenarios:**
- Give context and goal, not instructions
- Make it realistic and specific
- Don't use words from the interface
- Example: "You want to find a hotel in San Francisco for next weekend with free cancellation" (not "Click on the search button")

### Moderating Tests

**Best Practices:**
- Create comfortable environment
- Remind to think aloud
- Don't help or lead ("What would you do next?")
- Ask follow-up questions after tasks
- Note facial expressions and body language
- Stay neutral, don't defend the design
- Probe for reasoning: "Why did you click there?"

**Common Moderator Mistakes:**
- Explaining how things work
- Asking leading questions
- Interrupting the participant
- Defending design decisions
- Showing emotion when something fails

### Analyzing Results

**Identify Patterns:**
- Where did multiple users struggle?
- What errors occurred repeatedly?
- What did users expect that wasn't there?
- What positive feedback did you hear?
- Task completion rates and time on task

**Severity Ratings:**
- **Critical**: Prevents task completion, must fix
- **Serious**: Causes frustration, should fix
- **Minor**: Small annoyance, nice to fix
- **Enhancement**: Suggestion for improvement

**Creating Findings Report:**
1. Executive summary: Key findings and recommendations
2. Methodology: How you tested, with whom
3. Findings: Issues organized by severity
4. Video clips: Show real user struggles
5. Recommendations: Prioritized list of fixes

## Accessibility (A11y)

### WCAG Principles (POUR)

**Perceivable:**
- Provide text alternatives for images
- Provide captions for videos
- Create content that can be presented in different ways
- Make it easier to see and hear content

**Operable:**
- Make all functionality available from keyboard
- Give users enough time to read and use content
- Don't design content that causes seizures
- Help users navigate and find content

**Understandable:**
- Make text readable and understandable
- Make content appear and operate in predictable ways
- Help users avoid and correct mistakes

**Robust:**
- Maximize compatibility with current and future tools
- Use semantic HTML
- Ensure content works with assistive technologies

### Practical Accessibility Guidelines

**Color Contrast:**
- 4.5:1 for normal text (under 18pt or 14pt bold)
- 3:1 for large text (18pt+ or 14pt+ bold)
- 3:1 for UI components and graphics
- Test with contrast checker tools

**Keyboard Navigation:**
- All interactive elements reachable via Tab
- Logical tab order
- Visible focus indicators
- Support Esc to close modals
- Arrow keys for navigating lists/menus

**Screen Reader Support:**
- Use semantic HTML (button, nav, main, etc.)
- Provide alt text for meaningful images (empty alt for decorative)
- Label form inputs properly
- Use ARIA labels when needed (but HTML first)
- Skip to main content link

**Touch Targets:**
- Minimum 44x44pt (iOS) or 48x48dp (Android)
- Adequate spacing between targets
- Consider thumb zones on mobile

**Other Considerations:**
- Support text resize up to 200%
- Don't disable zoom on mobile
- Avoid time limits or allow extension
- Provide clear error messages
- Support dark mode when possible
- Reduce motion option for animations

## Design Handoff

### Design Specifications

**What Developers Need:**
- Component dimensions and spacing
- Typography (font family, size, weight, line height)
- Colors (hex codes or design tokens)
- Border radius, shadows, and effects
- Interaction states (hover, active, disabled)
- Breakpoints for responsive design
- Asset files (icons, images, illustrations)

**Tools for Handoff:**
- **Figma**: Dev mode with CSS/iOS/Android code
- **Zeplin**: Automatic specs and assets
- **InVision Inspect**: Specs and measurements
- **Avocode**: Code export and collaboration

### Asset Export

**Image Formats:**
- **PNG**: Screenshots, images with transparency
- **JPG**: Photos, no transparency needed
- **SVG**: Icons, logos, simple graphics (scalable)
- **WebP**: Modern format, better compression

**Export Sizes:**
- **Web**: 1x, 2x (Retina)
- **iOS**: 1x, 2x, 3x
- **Android**: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi

**Naming Conventions:**
- Use consistent, descriptive names
- Lowercase with hyphens or underscores
- Include size or variant in name
- Examples: `icon-search-24px.svg`, `hero-image@2x.png`

### Design System Documentation

**Component Documentation:**
- Component name and description
- When to use (and when not to use)
- Variants and options
- Anatomy (parts of the component)
- Behavior and interactions
- Code examples
- Accessibility notes
- Design tokens (colors, spacing)

**Living Documentation:**
- Keep up to date with actual implementation
- Include working code examples
- Show do's and don'ts
- Link to Figma components
- Version history

## Communication & Collaboration

### Presenting Design Decisions

**Design Rationale Framework:**
1. **Problem**: What user problem are we solving?
2. **Goals**: What are we trying to achieve?
3. **Options**: What alternatives did you consider?
4. **Decision**: What did you choose and why?
5. **Evidence**: What research or data supports this?
6. **Trade-offs**: What did you sacrifice?

**Storytelling:**
- Start with the user and their problem
- Walk through user journey
- Show before/after comparisons
- Use real examples and scenarios
- End with measurable outcomes

### Design Critique

**Giving Feedback:**
- Be specific and constructive
- Focus on the design, not the designer
- Explain the "why" behind your feedback
- Ask questions to understand intent
- Suggest alternatives when possible
- Balance positive and negative feedback

**Receiving Feedback:**
- Listen without defending
- Ask clarifying questions
- Separate personal preference from user needs
- Document all feedback
- Decide what to act on (not all feedback is equal)

### Working with Developers

**Best Practices:**
- Involve developers early in design process
- Understand technical constraints
- Be flexible on implementation details
- Provide design tokens and reusable components
- Use shared language (component names)
- Review implementation and provide feedback
- Celebrate collaboration wins

**Common Handoff Issues:**
- Missing states (loading, error, empty)
- Unclear interactions
- Missing edge cases
- Unrealistic content length
- Inconsistent spacing
- Non-standard components

## Design Process Workflow

### Double Diamond Process

**Discover** (Divergent)
→ Research, explore the problem space
→ User interviews, surveys, analytics

**Define** (Convergent)
→ Synthesize research, define the problem
→ Personas, journey maps, problem statement

**Develop** (Divergent)
→ Ideate solutions, explore options
→ Sketches, wireframes, prototypes

**Deliver** (Convergent)
→ Refine and implement solution
→ High-fidelity designs, testing, handoff

### Iterative Design

**Build → Measure → Learn Loop:**
1. **Build**: Create prototype or design
2. **Measure**: Test with users, collect data
3. **Learn**: Analyze findings, identify improvements
4. **Repeat**: Iterate based on learnings

**When to Iterate:**
- User testing reveals issues
- Analytics show drop-offs
- Stakeholder feedback
- Technical constraints
- New insights from research

## Tools & Software

### Design Tools

**Primary Design Tools:**
- **Figma**: Industry standard, collaborative, web-based
- **Sketch**: Mac-only, powerful for UI design
- **Adobe XD**: Adobe integration, prototyping
- **Framer**: Advanced prototyping, code-based

**Collaboration Tools:**
- **Miro**: Whiteboarding, workshops, brainstorming
- **FigJam**: Figma's whiteboarding tool
- **Whimsical**: Flowcharts, wireframes, mind maps
- **Notion**: Documentation, design system wiki

**Handoff & Inspection:**
- **Zeplin**: Design specs and assets
- **InVision**: Prototyping and collaboration
- **Abstract**: Version control for Sketch
- **Avocode**: Handoff and code export

**User Research:**
- **Lookback**: Remote user testing
- **UserTesting**: Participant recruiting and testing
- **Optimal Workshop**: Card sorting, tree testing
- **Hotjar**: Heatmaps and session recordings

### Plugins & Extensions

**Figma Plugins:**
- **Content Reel**: Realistic content generator
- **Stark**: Accessibility checker
- **Iconify**: Icon library access
- **Unsplash**: Free stock photos
- **Autoflow**: Flow diagram arrows
- **Contrast**: Color contrast checker

## Conclusion

This skill equips Claude to provide professional UX/UI design guidance covering the entire design process. The focus is on user-centered design, research-backed decisions, accessibility, and effective collaboration.

**Key Takeaways:**
- Always start with user research and empathy
- Design iteratively based on testing and feedback
- Accessibility is not optional
- Visual design supports functionality, not the other way around
- Document and communicate design decisions clearly
- Collaborate closely with developers
- Measure success with real user data
- Design systems create consistency and efficiency

Apply these principles to create intuitive, beautiful, accessible experiences that solve real user problems.
