# Literature Review Matrix — CallMind Intelligence

**Prepared for:** Mini Project–II (Research-Oriented Project with Implementation)
**Manuscript:** *Evidence-Linked Multi-Recording Conversation Intelligence for Structured Daily Reporting*
**Review date:** 25 November 2026
**Reviewer role:** Research assistant / technical documentation

This document records a structured review of eight peer-reviewed or formally published
research papers that are directly relevant to CallMind. Metadata was checked against
the ACL Anthology BibTeX records, the arXiv API, and Crossref where a DOI exists. No
finding or limitation below is invented; each statement is traceable to the paper's
abstract, its published metadata, or the paper's stated scope. Items that are the
reviewer's analytical interpretation are explicitly marked as such.

---

## 0. Review methodology

This was a **focused narrative review**, not a systematic literature review. Sources
consulted were ACL Anthology, arXiv, Crossref, and relevant conference proceedings and
publisher records. The search themes were meeting and conversation summarization,
action-item extraction, conversational memory, multi-session conversation understanding,
and source attribution and evidence-grounded information extraction. Papers were selected
for relevance to these themes and to the CallMind problem, not through an exhaustive or
reproducible systematic search. The review therefore does not claim complete coverage of
the field, and the gap statement in Section 4 is scoped to this reviewed set.

---

## 1. Verified bibliographic records

| # | Title | Authors | Year | Venue | DOI / verified URL | Type |
|---|-------|---------|------|-------|--------------------|------|
| P1 | Abstractive Meeting Summarization: A Survey | Virgile Rennard, Guokan Shang, Julie Hunter, Michalis Vazirgiannis | 2023 | Transactions of the Association for Computational Linguistics, vol. 11, pp. 861–884 | 10.1162/tacl_a_00578 · https://aclanthology.org/2023.tacl-1.49/ | Peer-reviewed journal (survey) |
| P2 | QMSum: A New Benchmark for Query-based Multi-domain Meeting Summarization | Ming Zhong, Da Yin, Tao Yu, Ahmad Zaidi, Mutethia Mutuma, Rahul Jha, Ahmed Hassan Awadallah, Asli Celikyilmaz, Yang Liu, Xipeng Qiu, Dragomir Radev | 2021 | Proceedings of NAACL-HLT 2021, pp. 5905–5921 | 10.18653/v1/2021.naacl-main.472 · https://aclanthology.org/2021.naacl-main.472/ | Peer-reviewed conference |
| P3 | Automatic Rephrasing of Transcripts-based Action Items | Amir DN Cohen, Amir Kantor, Sagi Hilleli, Eyal Kolman | 2021 | Findings of ACL-IJCNLP 2021, pp. 2862–2873 | 10.18653/v1/2021.findings-acl.253 · https://aclanthology.org/2021.findings-acl.253/ | Peer-reviewed findings track |
| P4 | Meeting Action Item Detection with Regularized Context Modeling | Jiaqing Liu, Chong Deng, Qinglin Zhang, Qian Chen, Wen Wang | 2023 | ICASSP 2023, Rhodes, Greece, pp. 1–5 | 10.1109/ICASSP49357.2023.10096053 · arXiv:2303.16763 | Peer-reviewed conference |
| P5 | Action-Item-Driven Summarization of Long Meeting Transcripts | Logan Golia, Jugal Kalita | 2023 | NLPIR 2023 (7th Int. Conf. on NLP and Information Retrieval), pp. 91–98 | 10.1145/3639233.3639253 · arXiv:2312.17581 | Peer-reviewed conference |
| P6 | Conversation Chronicles: Towards Diverse Temporal and Relational Dynamics in Multi-Session Conversations | Jihyoung Jang, Minseong Boo, Hyounghun Kim | 2023 | Proceedings of EMNLP 2023, pp. 13584–13606 | 10.18653/v1/2023.emnlp-main.838 · https://aclanthology.org/2023.emnlp-main.838/ | Peer-reviewed conference |
| P7 | Evaluating Very Long-Term Conversational Memory of LLM Agents | Adyasha Maharana, Dong-Ho Lee, Sergey Tulyakov, Mohit Bansal, Francesco Barbieri, Yuwei Fang | 2024 | Proceedings of ACL 2024 (Long Papers), pp. 13851–13870 | 10.18653/v1/2024.acl-long.747 · https://aclanthology.org/2024.acl-long.747/ | Peer-reviewed conference |
| P8 | Efficient Data Generation for Source-grounded Information-seeking Dialogs: A Use Case for Meeting Transcripts | Lotem Golany, Filippo Galgani, Maya Mamo, Nimrod Parasol, Omer Vandsburger, Nadav Bar, Ido Dagan | 2024 | Findings of EMNLP 2024, pp. 1908–1925 | 10.18653/v1/2024.findings-emnlp.106 · https://aclanthology.org/2024.findings-emnlp.106/ | Peer-reviewed findings track |

**Verification notes**

- P1–P3 and P6–P8 metadata were read from the official ACL Anthology `.bib` files.
- P4 DOI, venue, and pages 1–5 were confirmed through Crossref; the arXiv page lists ICASSP 2023 acceptance.
- P5 DOI, venue, and pages 91–98 were confirmed through Crossref; the arXiv page lists NLPIR 2023 acceptance.
- The manuscript's P5 reference prints the DOI URL and keeps the arXiv identifier as an additional access note.
- No metadata was copied from a secondary blog or product page.

---

## 2. Paper-by-paper review

### P1 — Abstractive Meeting Summarization: A Survey (Rennard et al., 2023)

- **Research problem.** Abstractive summarization of multi-party meetings is difficult
  because meetings are long, multi-topic, and conversational, while useful summaries must
  be fluent and content-selective.
- **Objectives.** Consolidate the task definition, datasets, models, and evaluation metrics
  for abstractive meeting summarization, and expose open challenges.
- **Methodology.** Structured survey of the task, corpora, encoder–decoder models, and
  evaluation practice.
- **Data / models.** Reviews multiple meeting corpora and neural encoder–decoder systems;
  the paper is a survey and does not introduce one new model.
- **Evaluation.** Discusses the metrics used in the field (e.g., overlap-based and
  learned metrics) and their limitations.
- **Major findings.** Deep encoder–decoder architectures substantially improved abstractive
  summarization, but meeting summarization remains constrained by long inputs, multi-party
  structure, and evaluation difficulty.
- **Limitations / open problems.** The survey's scope is summarization, not structured
  extraction, provenance enforcement, or consolidation across independent recordings.
- **Relevance to CallMind.** Establishes the general problem space and motivates a
  system-level design that goes beyond a single generated summary.

### P2 — QMSum (Zhong et al., 2021)

- **Research problem.** A single short meeting summary cannot satisfy different user
  information needs.
- **Objectives.** Define query-based, multi-domain meeting summarization and provide a
  benchmark.
- **Methodology.** Builds a query–summary benchmark and evaluates a locate-then-summarize
  approach plus strong summarization baselines.
- **Data.** 1,808 query–summary pairs over 232 meetings across multiple domains.
- **Models / techniques.** Query-conditioned span selection followed by summarization;
  neural summarization baselines.
- **Evaluation.** Standard summarization metrics plus manual analysis.
- **Major findings.** Long meeting summarization remains significantly challenging; query
  conditioning helps target the relevant content.
- **Limitations / open problems.** Query-based single-meeting setting; does not model
  multiple independent recordings, cross-recording conflicts, or evidence provenance as a
  first-class output.
- **Relevance to CallMind.** Supports the decision to make report content selective and
  user/report-date oriented rather than producing one undifferentiated summary.

### P3 — Automatic Rephrasing of Transcripts-based Action Items (Cohen et al., 2021)

- **Research problem.** Action items in spoken meeting transcripts are often vague,
  context-dependent, and hard to understand in isolation.
- **Objectives.** Given a transcribed meeting and an action item, generate a coherent,
  self-contained rephrasing of that action item.
- **Methodology.** Compiles an annotated meeting-transcript dataset with human rephrasings;
  establishes BART and UniLM baselines; adds coreference-derived features and an auxiliary
  context-detection model.
- **Data.** A purpose-built annotated meeting-transcript dataset (paper-specific).
- **Models / techniques.** BART, UniLM, coreference features, auxiliary context model,
  human evaluation.
- **Evaluation.** Systematic human evaluation of rephrasing quality.
- **Major findings.** The task is harder than an analogous email task because speech is
  broken and incomplete; additional context information materially improves the baselines;
  the best models approach human-level rephrasing on a constrained subset.
- **Limitations / open problems.** Focused on rephrasing a known action item, not on
  discovering all action items across many recordings, nor on linking claims to exact
  transcript spans or consolidating them.
- **Relevance to CallMind.** Motivates preserving original expressions and context, and
  supports CallMind's explicit/inferred distinction and evidence-linked summaries.

### P4 — Meeting Action Item Detection with Regularized Context Modeling (Liu et al., 2023)

- **Research problem.** Detecting which meeting content corresponds to action items is
  hampered by scarce and small manually annotated datasets.
- **Objectives.** Improve action-item detection accuracy and robustness.
- **Methodology.** Constructs a Chinese meeting corpus with manual action-item annotations;
  proposes Context-Drop to combine local and global context through contrastive learning;
  proposes a lightweight model ensemble over pre-trained models.
- **Data.** A newly constructed Chinese meeting corpus and the English AMI corpus.
- **Models / techniques.** Pre-trained language models, contrastive learning, Context-Drop,
  lightweight ensemble.
- **Evaluation.** Detection accuracy and robustness on the two corpora.
- **Major findings.** Using both local and global context improves accuracy and robustness;
  ensembling different pre-trained models is effective.
- **Limitations / open problems.** Detection is not the same as structured extraction with
  typed fields; the work is meeting-centric and does not address multi-recording
  consolidation or provenance-preserving reporting.
- **Relevance to CallMind.** Supports context-aware extraction and warns that annotated
  action-item data is scarce—directly relevant to CallMind's evaluation limitation.

### P5 — Action-Item-Driven Summarization of Long Meeting Transcripts (Golia & Kalita, 2023)

- **Research problem.** Generic meeting summaries are often too basic and omit the
  action items that make a meeting actionable.
- **Objectives.** Generate abstractive meeting summaries driven by the action items in the
  transcript.
- **Methodology.** Recursively summarizes topic-based transcript sections in parallel,
  applies an action-item extraction algorithm per section, and combines sectional
  summaries into a coherent action-item-driven summary; introduces three transcript
  segmentation methods.
- **Data.** AMI corpus.
- **Models / techniques.** LLM-based recursive summarization, action-item extraction,
  topic-based segmentation.
- **Evaluation.** BERTScore on the AMI corpus.
- **Major findings.** The pipeline achieved a BERTScore of 64.98 on AMI, approximately a
  4.98% improvement over a fine-tuned BART baseline, while segmentation mitigates
  long-context forgetting.
- **Limitations / open problems.** Single-meeting input; action-item extraction is used to
  steer summarization rather than to produce a typed, provenance-linked, cross-recording
  record; no explicit conflict handling.
- **Relevance to CallMind.** Closest prior work to action-item-driven reporting; CallMind
  differs by separating per-recording structured extraction from deterministic
  cross-recording consolidation and by enforcing evidence validation.

### P6 — Conversation Chronicles (Jang et al., 2023)

- **Research problem.** Open-domain dialogue research focuses on short single-session
  conversations and neglects multi-session context.
- **Objectives.** Build a large multi-session dialogue dataset that incorporates time
  intervals and fine-grained speaker relationships, and propose a dialogue model for it.
- **Methodology.** Uses an LLM to generate a 1M multi-session dialogue dataset; validates
  it with extensive human evaluation; proposes ReBot, which combines chronological
  summarization and dialogue generation (~630M parameters).
- **Data.** Conversation Chronicles, a 1M multi-session dialogue dataset.
- **Models / techniques.** LLM-based data generation, chronological summarization,
  dialogue generation (ReBot).
- **Evaluation.** Human evaluation of coherence/consistency plus dialogue-model evaluation.
- **Major findings.** Multi-session episodes can reflect temporal and relational dynamics
  while remaining coherent; explicit temporal/relational structure is important.
- **Limitations / open problems.** Synthetic open-domain dialogues; not real audio
  recordings; does not produce typed task/decision records or provenance-linked reports.
- **Relevance to CallMind.** Supports treating time and relationships as first-class
  signals when reasoning across sessions, which CallMind approximates through report dates,
  IANA timezones, and proposed relationships.

### P7 — Evaluating Very Long-Term Conversational Memory of LLM Agents (Maharana et al., 2024)

- **Research problem.** The efficacy of long-context LLMs and retrieval-augmented
  generation (RAG) in very long-term dialogues is unexplored.
- **Objectives.** Generate high-quality very long-term dialogues and build a benchmark for
  long-term memory.
- **Methodology.** Machine–human pipeline using LLM-based agents grounded on personas and
  temporal event graphs; human verification/editing; a benchmark covering question
  answering, event summarization, and multimodal dialogue generation.
- **Data.** LoCoMo: conversations averaging 600 turns and 16K tokens over up to 32 sessions.
- **Models / techniques.** LLM agents, temporal event graphs, long-context LLMs, RAG,
  human annotation.
- **Evaluation.** QA, event summarization, and multimodal dialogue generation.
- **Major findings.** LLMs struggle with lengthy conversations and long-range temporal and
  causal dynamics; long-context and RAG help but do not fully solve the problem.
- **Limitations / open problems.** Synthetic/curated long-term chat rather than real
  multi-recording audio; no structured extraction, conflict review, or evidence-span
  enforcement.
- **Relevance to CallMind.** Provides the strongest justification for caution: naive
  long-context reasoning over many conversations is unreliable, which motivates CallMind's
  per-recording extraction plus deterministic, conservative consolidation.

### P8 — Efficient Data Generation for Source-grounded Information-seeking Dialogs (Golany et al., 2024)

- **Research problem.** Source-grounded information-seeking dialogue with response
  attribution over long, noisy documents is difficult, and automating attribution remains
  hard.
- **Objectives.** Test whether LLM-based data generation can produce source-grounded
  information-seeking dialogs over long meeting transcripts.
- **Methodology.** Semi-automatic pipeline: LLM-generated queries and responses followed by
  human verification and identification of attribution spans; creates the MISeD dataset.
- **Data.** MISeD — information-seeking dialogs focused on meeting transcripts.
- **Models / techniques.** LLM data generation, human attribution annotation, fine-tuning,
  response-attribution evaluation.
- **Evaluation.** Response generation quality and attribution quality.
- **Major findings.** Models fine-tuned on MISeD outperform larger off-the-shelf models;
  fine-tuning on MISeD gives response quality comparable to fully manual data while
  improving attribution and reducing effort.
- **Limitations / open problems.** Dialog-level source grounding over transcripts, not a
  multi-recording daily report; attribution is evaluated at dialog-response level rather
  than enforced as a hard segment/quote/timestamp contract at ingestion time.
- **Relevance to CallMind.** Directly supports evidence/source grounding as a first-class
  requirement and shows that attribution is both valuable and non-trivial.

---

## 3. Comparative analysis

The symbols below are **reviewer assessments** of each paper's scope, not claims made by
the authors: ● = central to the paper; ◐ = partially addressed or incidental; ○ = not
addressed.

| Capability | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| Speech transcription (ASR) | ○ | ○ | ◐ (uses transcripts) | ◐ (uses transcripts) | ◐ (uses transcripts) | ○ | ○ | ◐ (uses transcripts) |
| Meeting / conversation summarization | ● | ● | ◐ | ○ | ● | ◐ | ◐ | ◐ |
| Task / action-item extraction | ◐ | ◐ | ● | ● | ● | ○ | ○ | ○ |
| Multi-session / long-term understanding | ○ | ○ | ○ | ○ | ○ | ● | ● | ○ |
| Source-grounded retrieval / attribution | ○ | ◐ (query spans) | ○ | ○ | ○ | ○ | ◐ (event graphs) | ● |
| Temporal / relational reasoning | ◐ | ◐ | ◐ | ○ | ◐ | ● | ● | ○ |
| Information consolidation across independent recordings | ○ | ○ | ○ | ○ | ○ | ◐ (sessions) | ◐ (sessions) | ○ |

### 3.1 Speech transcription

None of the eight papers contributes a new ASR system. P3–P5 and P8 consume transcripts
produced elsewhere, which is exactly the regime CallMind operates in: it treats ASR as a
pluggable upstream stage and concentrates on structuring and consolidating the resulting
text. This separation is important because transcription errors propagate into extraction;
CallMind therefore validates extracted evidence against the stored transcript rather than
trusting the model's self-report.

### 3.2 Meeting / conversation summarization

P1 and P2 establish the summarization problem and its evaluation difficulty. P5 shows that
action items can drive summarization. CallMind does not attempt to replace these methods;
it uses a per-recording LLM summary plus typed insights, and then consolidates across
recordings. The literature therefore supplies the summarization substrate but not the
multi-recording reporting layer.

### 3.3 Task and action-item extraction

P3, P4, and P5 are the closest technical neighbours. They focus on rephrasing a known
action item, detecting action-item spans, or using action items to steer a summary. None
produces a typed schema spanning tasks, dates, decisions, commitments, transactions,
projects, risks, and questions, and none enforces a per-insight quote/segment/timestamp
contract. CallMind's contribution is the typed, evidence-linked representation rather than
a new detector.

### 3.4 Multi-session conversation understanding

P6 and P7 show that time intervals, speaker relationships, and long-range dependencies
matter, and that long-context LLMs remain unreliable for very long histories. This is the
main reason CallMind does not ask one LLM to read all recordings at once. Instead, each
recording is analysed independently, and cross-recording consolidation is deterministic
and conservative.

### 3.5 Source-grounded information retrieval

P8 demonstrates that source attribution over long meeting transcripts is valuable and
difficult, and that human verification remains important. CallMind operationalises
attribution as a hard validation contract: an extracted insight is persisted only if its
quote occurs in the referenced transcript segment and its timestamps match within a
tolerance. This is stricter than response-level attribution and is enforced at both the
analysis and report layers.

### 3.6 Temporal and relational reasoning

P6 and P7 model time and relationships explicitly. CallMind approximates this with
report-date/IANA-timezone scoping and with proposed relationship types (shared entity,
shared topic, task update, deadline revision, value revision). CallMind does not claim
P6/P7-level temporal reasoning; its relationships are explicitly proposed, not confirmed.

### 3.7 Information consolidation

No reviewed paper consolidates multiple independent recordings into a single dated report
with source lineage, duplicate handling, and reviewable conflicts. P5 and P6/P7 consolidate
within a meeting or across sessions of one synthetic dialogue, but not across separate
audio recordings with independent transcripts and analyses. This is the clearest gap.

---

## 4. Research gap justified by the review

The literature has produced strong methods for (i) meeting summarization (P1, P2, P5),
(ii) action-item detection/rephrasing (P3, P4), (iii) multi-session memory (P6, P7), and
(iv) source-grounded attribution (P8). These strands are usually studied separately and
usually assume a single meeting, a single synthetic dialogue, or a modelling benchmark.

Within the selected literature, what is comparatively under-served is the
**system-level integration** of the following in one general-purpose pipeline:

1. multiple independent audio recordings, each transcribed and analysed separately;
2. typed structured extraction covering tasks, dates, decisions, commitments, people,
   projects, risks, questions, and related fields;
3. a hard evidence contract linking each extracted item to a transcript segment, quote,
   and timestamp;
4. conservative cross-recording consolidation that preserves source lineage and surfaces
   only explicit, reviewable disagreements; and
5. a report-driven dashboard that renders only the categories actually present.

The review therefore supports a gap statement of the form: *among the reviewed literature,
we did not find an end-to-end system that combines per-recording evidence-linked extraction
with cautious cross-recording daily-report consolidation and provenance-preserving review.*
This is deliberately weaker than a "no system exists" claim and is the claim used in the
manuscript.

---

## 5. What the review does **not** establish

- It does not establish that CallMind is the first system of its kind.
- It does not provide a quantitative baseline: the reviewed papers use different datasets,
  tasks, and metrics, so their reported numbers cannot be compared with CallMind's
  descriptive results.
- It does not validate CallMind's extraction accuracy. The reviewed work confirms that
  annotated action-item data is scarce (P4) and that attribution is hard (P8), which is
  consistent with CallMind's decision to report functional verification separately from
  model accuracy.
