## Privacy Policy for the Sokrates^t^ Educational Platform

**Effective Date:** 17 April 2025

### 1. Introduction and Scope

This Privacy Policy details the data processing practices of the Sokrates^t^ Project Team at Rhine-Waal University ("Project Team", "We", "Us", "Our") in relation to the provision and use of the Sokrates^t^ educational platform ("Sokrates^t^" or the "Platform"). Sokrates^t^ is a research-oriented platform developed by the Project Team, designed to facilitate Artificial Intelligence (AI)-assisted Socratic dialogue for educational purposes within designated courses. This policy applies to all registered users ("User", "You", "Your") participating in the current testing phase of the Platform. Use of the Platform is currently restricted to invited participants and is provided completely free of charge.

### 2. Data Controller

The entity legally responsible for the processing of personal data under this policy (the "Controller") is:

Rhine-Waal University
Friedrich-Heinrich-Allee 25
47475 Kamp-Lintfort
Germany

Email for privacy-related inquiries: [sokratest@hochschule-rhein-waal.de](mailto:sokratest@hochschule-rhein-waal.de)

### 3. Data Protection Officer (DPO)

The Data Protection Officer (DPO) designated for Rhine-Waal University can be contacted via:

Rhine-Waal University
Marie-Curie-Straße 1
47533 Kleve
Germany

Email: [datenschutz@hochschule-rhein-waal.de](mailto:datenschutz@hochschule-rhein-waal.de)

Inquiries regarding general data protection directed to the DPO should clearly reference the Sokrates^t^ platform.


### 4. Platform Functionality and Purpose of Data Processing

Sokrates^t^ enables registered student users to engage in interactive dialogues with an AI. To facilitate contextually relevant interactions, designated course instructors may upload course-related documents (including, but not limited to, PDF files, Microsoft Word documents, PowerPoint presentations, and image files) to the Platform. These documents undergo an internal processing workflow involving text and image extraction, generation of semantic representations (embeddings), and storage within a vector database. This processed information is utilised via a Retrieval-Augmented Generation (RAG) process to inform and enhance the AI's responses within the dialogue.

### 5. Personal Data Processed

In the course of operating Sokrates^t^, We collect and process the following categories of personal data:

*   **User Identification and Authentication Data:** University-issued email address provided during the invitation/registration process; a unique system-generated User ID assigned to each account; User-chosen passwords, which are stored solely in a securely hashed format (irreversible encryption). No alternative login methods are currently supported.
*   **User Interaction Data:** Records of the chat dialogues conducted between the User and the AI; any feedback voluntarily submitted by the User through the Platform's interface regarding the AI's performance or the User experience.
*   **Technical Usage Data (Web Analytics):** Standard web server log information and analytics data, collected via a self-hosted instance of the Umami analytics tool. This includes the User's device information, browser type and version, operating system, specific pages visited within the Sokrates^t^ platform, timestamps of access, and referring URLs (if applicable). Your IP Address will be used to infer your location (country, region and city), but will not be stored.

**Exclusion of Sensitive Data:** We explicitly do not collect or process sensitive personal data (as defined under Article 9 GDPR), such as racial or ethnic origin, political opinions, religious beliefs, health data, or data concerning a natural person's sex life or sexual orientation. Furthermore, We do not collect academic grades or formal performance evaluations through the Sokrates^t^ platform. The processing is limited to the data types listed above, primarily the university-issued email address and user-generated chat history.

### 6. Legal Basis for Processing (GDPR) and Purposes of Data Processing

The processing of Your personal data is conducted based on the following legal ground as defined in the General Data Protection Regulation (GDPR):

*   **Consent (Art. 6(1)(a) GDPR):** Your explicit consent, signified by Your acceptance of this Privacy Policy upon account creation/first login, is the primary legal basis for processing Your personal data to provide You with access to and use of the Sokrates^t^ Platform's core functionalities.
*   In the context of providing this Platform for educational and research purposes in our capacity as a public university, we process those personal data described in Section 5 of this Privacy Policy with regard to technical requirements and the research context. In accordance, the purposes of processing Your data are:
    *   Providing, maintaining, and ensuring the technical functionality and security of the Platform during its research and development phase.
    *   Analysing usage patterns and user feedback to improve the Platform's features, usability, and educational effectiveness.
    *   Conducting internal research related to AI in education and the efficacy of the Sokrates^t^ approach (data used for research publications or external reporting will be aggregated or fully anonymised).
    *   Enabling essential features, such as persisting chat history to allow Users access across multiple devices associated with their account.
    *   Troubleshooting technical issues and providing support.

### 7. Data Storage, Security Measures, and International Transfers

#### 7.1. Location of Storage and Processing:
All personal data collected and processed for Sokrates^t^ is stored and processed exclusively within the Federal Republic of Germany.
*   **Primary Platform Hosting:** The core Sokrates^t^ application, databases (PostgreSQL), vector database (Qdrant), object storage (Minio), LLM observability tools (Langfuse), task queue (trigger.dev), and web analytics (Umami) are operated on a Virtual Private Server (VPS) hosted by IONOS SE, with servers located physically within Germany.
*   **AI Model Processing:** The AI models underpinning the dialogue functionality are provided and hosted exclusively by Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen (GWDG), Burckhardtweg 4, 37077 Göttingen, Germany ("GWDG"). All AI-related processing occurs solely within GWDG's own infrastructure in Göttingen, Germany. Based on information provided by GWDG (refer to their privacy policy linked below), they do not persistently store user prompts or AI responses sent to their service for the operation of Sokrates^t^ and utilise open source self-hosted models, not commercial third-party AI services (e.g., OpenAI, Anthropic, Google).

#### 7.2. Data Security:
We implement appropriate technical and organisational measures designed to protect Your personal data against accidental or unlawful destruction, loss, alteration, unauthorised disclosure, or access. These measures include the use of Transport Layer Security (TLS/SSL) for data encryption during transmission between Your browser and Our servers, and between Our servers and GWDG. Data such as passwords are stored using secure hashing algorithms. We strive to follow industry best practices for the technologies employed (NextJS, PostgreSQL, etc.).

#### 7.3. International Data Transfers:
No personal data related to Your use of Sokrates^t^ is transferred to, stored in, or processed by entities located outside the Federal Republic of Germany, and therefore remains within the jurisdiction of the GDPR.

#### 7.4. Data Backup and Integrity during Testing Phase:
**Please be advised that Sokrates^t^ is currently in an active research and testing phase.** During this phase, while We strive to maintain data integrity, **regular, comprehensive backups of user data (including chat history) are not guaranteed.** Operational requirements, system updates, or unforeseen technical issues **may potentially lead to data loss.** The Project Team accepts no liability for any loss of data incurred during this testing phase. This condition is accepted by the User upon consenting to this policy, acknowledging the experimental nature of the Platform.

### 8. Data Retention Period

Personal data associated with Your Sokrates^t^ account (including user ID, email, chat history, feedback) will be retained, at a minimum, until the planned conclusion of the current Sokrates^t^ research project phase, anticipated for **October 31, 2025**.

Data may be retained beyond this date in an **aggregated or fully anonymised format** (whereby it is no longer possible to identify You as an individual) for the purposes of long-term research analysis, statistical reporting, or continued development efforts of the Sokrates^t^ Platform.

You retain the right to request the deletion of Your identifiable personal data prior to this date (see Section 11: Your Rights Under GDPR). Upon such a request, or after the data is no longer needed for the primary operational or defined research purposes in an identifiable form, Your directly identifiable data (email, unique ID, associated chats linked directly to the ID) will be securely deleted from operational systems. However, please note that usage data already incorporated into anonymised statistical analyses or backups existing at the time of deletion request might persist in that anonymised state.

### 9. Third-Party Services / Sub-processors

We utilise the following third-party entities in the provision of Sokrates^t^:

*   **Gesellschaft für wissenschaftliche Datenverarbeitung mbH Göttingen (GWDG):**
    *   Address: Burckhardtweg 4, 37077 Göttingen, Germany
    *   Role: Sub-processor providing the AI model hosting and inference services.
    *   Website: [gwdg.de](https://www.gwdg.de)
    *   Contact: [support@gwdg.de](mailto:support@gwdg.de) / +49 551 39-30000
    *   [Relevant Privacy Policy](https://datenschutz.gwdg.de/services/chatai)
*   **IONOS SE:**
	*   Address: Elgendorfer Str. 57, 56410 Montabaur, Germany
    *   Role: Hosting provider for the primary VPS, databases, and associated self-hosted tools, with infrastructure located in Germany.
	*   Website: [ionos.de](https://www.ionos.de/impressum)

Other tools mentioned (PostgreSQL, Qdrant, Minio, Langfuse, Umami, NextJS) are operated within Our self-hosted environment on the IONOS infrastructure and do not involve sharing personal data with the software vendors themselves as external third parties in the context of data processing for Sokrates^t^ users.

### 10. Cookies and Tracking Technologies

Sokrates^t^ utilises cookies for specific, limited purposes:

*   **Authentication Cookies (JWT):** Essential cookies used to securely manage User login sessions and verify identity after login.
*   **Preference Cookies:** Used to store User interface preferences (e.g., enabling 'dark mode').

**We do not use third-party cookies.** We do not engage in cross-site tracking, behavioural advertising, or employ cookies from external advertising networks or social media platforms.

### 11. Your Rights Under GDPR

As a data subject located within the European Union/European Economic Area, You possess the following rights under the GDPR regarding Your personal data processed by Us in the context of Sokrates^t^:

*   **Right of Access (Art. 15 GDPR):** To request confirmation of whether We process Your personal data and, if so, to access that data and supplementary information. Basic account information and chat history are accessible via Your account interface.
*   **Right to Rectification (Art. 16 GDPR):** To request the correction of inaccurate personal data We hold about You.
*   **Right to Erasure ('Right to be Forgotten') (Art. 17 GDPR):** To request the deletion of Your personal data under specific conditions (e.g., data no longer necessary, withdrawal of consent). Exercising this right will result in the deletion of Your Sokrates^t^ account and loss of access.
*   **Right to Restriction of Processing (Art. 18 GDPR):** To request the limitation of how We process Your personal data under certain circumstances.
*   **Right to Data Portability (Art. 20 GDPR):** To receive Your personal data (which You provided to Us based on consent) in a structured, commonly used, machine-readable format, and potentially transmit it to another controller.
*   **Right to Object (Art. 21 GDPR):** To object to the processing of Your personal data based on Our legitimate interests (Art. 6(1)(f) GDPR) on grounds relating to Your particular situation.
*   **Right to Withdraw Consent (Art. 7(3) GDPR):** To withdraw Your previously given consent for processing at any time. This withdrawal will not affect the lawfulness of processing based on consent before its withdrawal. Withdrawal necessitates the deletion of Your account.
*   **Right to Lodge a Complaint (Art. 77 GDPR):** To lodge a complaint with a competent data protection supervisory authority (e.g., the LDI NRW for North Rhine-Westphalia, or the authority in Your EU Member State of residence/work).

**Exercising Your Rights:** Due to the closed, research-oriented nature of the current Sokrates^t^ deployment where access is managed via instructors, please direct requests concerning access (beyond what the interface provides), data extraction (portability), rectification, erasure, restriction, or withdrawal of consent **initially to Your respective course instructor.** The instructor acts as the primary point of contact and liaison for managing user participation and related data requests during this phase. If You encounter difficulties or have general privacy concerns, You may also contact the designated privacy email (Section 2) or the DPO (Section 3).

### 12. Age Restriction

Use of the Sokrates^t^ platform is strictly limited to individuals who are eighteen (18) years of age or older. By accepting this Privacy Policy and creating an account, You represent and warrant that You meet this minimum age requirement. We do not knowingly collect data from individuals under 18.

### 13. Changes to this Privacy Policy

We reserve the right to modify this Privacy Policy at any time, particularly as the Platform evolves or if legal requirements change. Should significant changes be made, We will provide notice to You through a clear notification presented upon Your next login to the Platform. This notification will summarise the key changes. Your continued use of Sokrates^t^ following such notification will require Your explicit acceptance of the revised Privacy Policy. Should You not agree to the updated terms, You will be provided with the option to decline and request the deletion of Your account. The "Effective Date" at the beginning of this document indicates the date of the last revision. We do not anticipate major changes during the initial testing phase.

### 14. Contact Information

For inquiries regarding this Privacy Policy or data processing related to Sokrates^t^, please:
1.  Contact Your respective course instructor (for user-specific requests like deletion).
2.  Contact the designated privacy email: [sokratest@hochschule-rhein-waal.de](mailto:sokratest@hochschule-rhein-waal.de)
3.  Contact the Data Protection Officer for Rhine-Waal University (regarding general data protection questions; see Section 3 for details).