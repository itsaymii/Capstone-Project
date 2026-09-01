import { useEffect, useMemo, useState } from 'react'
import {
  getAdminSimulationQuiz,
  publishAdminSimulationQuiz,
  updateAdminSimulationQuiz,
  uploadAdminSimulationQuizPdf,
} from '../services/api'
import { getSimulationCourses, loadSimulationCoursesFromServer, type SimulationCourse } from '../services/simulationCourses'
import type { SimulationAdminQuiz, SimulationAdminQuizQuestion } from '../types/api'

type SimulationQuizManagerProps = {
  embedded?: boolean
}

type FeedbackTone = 'success' | 'error'

type DraftQuestion = {
  prompt: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

function toDraftQuestions(questions: SimulationAdminQuizQuestion[]): DraftQuestion[] {
  return questions.map((question) => ({
    prompt: question.prompt,
    options: [...question.options],
    correctOptionIndex: question.correctOptionIndex,
    explanation: question.explanation,
  }))
}

export function SimulationQuizManager({ embedded = false }: SimulationQuizManagerProps) {
  const [courses, setCourses] = useState<SimulationCourse[]>(() => getSimulationCourses())
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [selectedLessonId, setSelectedLessonId] = useState<string>('')

  const [activeQuiz, setActiveQuiz] = useState<SimulationAdminQuiz | null>(null)
  const [draftTitle, setDraftTitle] = useState('Module Quiz')
  const [draftPassingScore, setDraftPassingScore] = useState(80)
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([])

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [isQuizReviewOpen, setIsQuizReviewOpen] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('success')

  const sectionClass = embedded
    ? 'rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
    : 'rounded-3xl border border-slate-700 bg-[#232837] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.25)]'
  const bodyTextClass = embedded ? 'text-slate-700' : 'text-slate-300'
  const headingTextClass = embedded ? 'text-slate-900' : 'text-white'
  const mutedTextClass = embedded ? 'text-slate-500' : 'text-slate-400'
  const inputClass = embedded
    ? 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
    : 'w-full rounded-xl border border-slate-600 bg-[#1d2230] px-3 py-2 text-sm text-white outline-none'
  const textareaClass = embedded
    ? 'min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
    : 'min-h-20 w-full rounded-xl border border-slate-600 bg-[#1d2230] px-3 py-2 text-sm text-white outline-none'
  const buttonPrimaryClass = embedded
    ? 'rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60'
    : 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60'
  const buttonSecondaryClass = embedded
    ? 'rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60'
    : 'rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:opacity-60'
  const modalOverlayClass = 'fixed inset-0 z-[1500] bg-slate-950/35 p-4 backdrop-blur-md sm:p-8'
  const modalPanelClass = 'mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.28)]'
  const modalInputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
  const modalTextareaClass = 'min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'

  const hasParsedQuiz = Boolean(activeQuiz && draftQuestions.length > 0)

  useEffect(() => {
    let isActive = true

    async function syncCourses(): Promise<void> {
      try {
        const syncedCourses = await loadSimulationCoursesFromServer()
        if (!isActive) {
          return
        }
        setCourses(syncedCourses)
      } catch {
        if (isActive) {
          setCourses(getSimulationCourses())
        }
      }
    }

    void syncCourses()
    return () => {
      isActive = false
    }
  }, [])

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  )

  const selectedLesson = useMemo(
    () => selectedCourse?.lessonOutline.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [selectedCourse, selectedLessonId],
  )

  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedLessonId('')
      return
    }

    const lessonExists = selectedCourse?.lessonOutline.some((lesson) => lesson.id === selectedLessonId)
    if (!lessonExists) {
      setSelectedLessonId(selectedCourse?.lessonOutline[0]?.id || '')
    }
  }, [selectedCourse, selectedCourseId, selectedLessonId])

  useEffect(() => {
    async function loadQuiz() {
      if (!selectedCourseId || !selectedLessonId) {
        setActiveQuiz(null)
        setDraftQuestions([])
        setDraftTitle('Module Quiz')
        setDraftPassingScore(80)
        return
      }

      setLoading(true)
      setFeedbackMessage('')

      try {
        const response = await getAdminSimulationQuiz(selectedCourseId, selectedLessonId)
        const quiz = response.quiz
        setActiveQuiz(quiz)
        if (quiz) {
          setDraftTitle(quiz.title)
          setDraftPassingScore(quiz.passingScore)
          setDraftQuestions(toDraftQuestions(quiz.questions))
        } else {
          setDraftTitle(`${selectedLesson?.title || 'Module'} Quiz`)
          setDraftPassingScore(80)
          setDraftQuestions([])
        }
      } catch (error) {
        setFeedbackTone('error')
        setFeedbackMessage(error instanceof Error ? error.message : 'Unable to load quiz details.')
      } finally {
        setLoading(false)
      }
    }

    void loadQuiz()
  }, [selectedCourseId, selectedLessonId, selectedLesson])

  function updateQuestion(index: number, updater: (current: DraftQuestion) => DraftQuestion): void {
    setDraftQuestions((current) => current.map((question, questionIndex) => (questionIndex === index ? updater(question) : question)))
  }

  async function handleUploadPdf(): Promise<void> {
    if (!selectedCourseId || !selectedLessonId || !uploadFile) {
      setFeedbackTone('error')
      setFeedbackMessage('Select a course, module, and PDF file first.')
      return
    }

    setSaving(true)
    setFeedbackMessage('')

    try {
      const response = await uploadAdminSimulationQuizPdf({
        courseId: selectedCourseId,
        lessonId: selectedLessonId,
        lessonTitle: selectedLesson?.title,
        title: draftTitle,
        passingScore: draftPassingScore,
        pdf: uploadFile,
      })
      setActiveQuiz(response.quiz)
      setDraftTitle(response.quiz.title)
      setDraftPassingScore(response.quiz.passingScore)
      setDraftQuestions(toDraftQuestions(response.quiz.questions))
      setUploadFile(null)
      setIsQuizReviewOpen(true)
      setFeedbackTone('success')
      setFeedbackMessage(`PDF parsed successfully (${response.quiz.questions.length} questions). Review before publishing.`)
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to parse uploaded PDF.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!activeQuiz) {
      setFeedbackTone('error')
      setFeedbackMessage('Upload a PDF first to create a draft quiz.')
      return
    }

    setSaving(true)
    setFeedbackMessage('')

    try {
      const response = await updateAdminSimulationQuiz(activeQuiz.id, {
        title: draftTitle,
        lessonTitle: selectedLesson?.title,
        passingScore: draftPassingScore,
        questions: draftQuestions,
      })
      setActiveQuiz(response.quiz)
      setDraftQuestions(toDraftQuestions(response.quiz.questions))
      setFeedbackTone('success')
      setFeedbackMessage('Quiz draft saved.')
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(error instanceof Error ? error.message : 'Unable to save quiz draft.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(): Promise<void> {
    if (!activeQuiz) {
      setFeedbackTone('error')
      setFeedbackMessage('No draft quiz to publish.')
      return
    }

    setPublishing(true)
    setFeedbackMessage('')

    try {
      const response = await publishAdminSimulationQuiz(activeQuiz.id)
      setActiveQuiz(response.quiz)
      setFeedbackTone('success')
      setFeedbackMessage(`Quiz published (v${response.quiz.version}). Learners can now take this module quiz.`)
    } catch (error) {
      setFeedbackTone('error')
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to publish quiz.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className={sectionClass}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.16em] ${mutedTextClass}`}>PDF Quiz Manager</p>
          <h3 className={`mt-1 text-2xl font-black ${headingTextClass}`}>Module Quizzes from PDF</h3>
          <p className={`mt-2 max-w-3xl text-sm ${bodyTextClass}`}>
            Upload a PDF answer sheet for each module, review extracted questions, and publish only when verified.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Course</span>
          <select className={inputClass} onChange={(event) => setSelectedCourseId(event.target.value)} value={selectedCourseId}>
            <option value="">Select course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Module</span>
          <select className={inputClass} onChange={(event) => setSelectedLessonId(event.target.value)} value={selectedLessonId}>
            <option value="">Select module</option>
            {(selectedCourse?.lessonOutline || []).map((lesson) => (
              <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Quiz Title</span>
          <input className={inputClass} onChange={(event) => setDraftTitle(event.target.value)} type="text" value={draftTitle} />
        </label>

        <label className="block">
          <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Passing Score (%)</span>
          <input
            className={inputClass}
            max={100}
            min={1}
            onChange={(event) => setDraftPassingScore(Math.min(100, Math.max(1, Number.parseInt(event.target.value || '80', 10))))}
            type="number"
            value={draftPassingScore}
          />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Upload Quiz PDF</span>
            <input
              accept="application/pdf,.pdf"
              className={inputClass}
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              type="file"
            />
            {uploadFile ? <p className={`mt-2 text-xs ${mutedTextClass}`}>Selected: {uploadFile.name}</p> : null}
          </label>

          <button className={buttonPrimaryClass} disabled={saving || loading || !uploadFile} onClick={() => void handleUploadPdf()} type="button">
            {saving ? 'Parsing PDF...' : 'Upload and Parse'}
          </button>
        </div>

        {activeQuiz ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            Status: <span className="font-semibold uppercase">{activeQuiz.status}</span> | Version {activeQuiz.version} | Parse confidence {activeQuiz.parseConfidence}%
            {activeQuiz.parseNotes ? <p className="mt-1">{activeQuiz.parseNotes}</p> : null}
            {activeQuiz.sourcePdfName ? <p className="mt-1">Source: {activeQuiz.sourcePdfName}</p> : null}
            {hasParsedQuiz ? (
              <div className="mt-3">
                <button className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm transition hover:bg-blue-100" onClick={() => setIsQuizReviewOpen(true)} type="button">
                  Open Quiz Review
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {feedbackMessage && !isQuizReviewOpen ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedbackTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {feedbackMessage}
        </div>
      ) : null}

      {loading ? <p className={`mt-5 text-sm ${bodyTextClass}`}>Loading quiz...</p> : null}

      {!loading && draftQuestions.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No parsed questions yet. Upload a PDF to generate a draft.
        </div>
      ) : null}

      {isQuizReviewOpen && hasParsedQuiz ? (
        <div className={modalOverlayClass} onClick={() => setIsQuizReviewOpen(false)}>
          <div className={modalPanelClass} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Parsed Quiz Review</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{draftTitle}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Review the parsed questions, adjust answer keys, then save or publish this module quiz.
                </p>
              </div>
              <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={() => setIsQuizReviewOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p>
                  Status: <span className="font-semibold uppercase">{activeQuiz?.status}</span> | Version {activeQuiz?.version} | Parse confidence {activeQuiz?.parseConfidence}%
                </p>
                {activeQuiz?.parseNotes ? <p className="mt-1">{activeQuiz.parseNotes}</p> : null}
                {activeQuiz?.sourcePdfName ? <p className="mt-1">Source: {activeQuiz.sourcePdfName}</p> : null}
              </div>

              {feedbackMessage ? (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${feedbackTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {feedbackMessage}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz Title</span>
                  <input className={modalInputClass} onChange={(event) => setDraftTitle(event.target.value)} type="text" value={draftTitle} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Passing Score (%)</span>
                  <input
                    className={modalInputClass}
                    max={100}
                    min={1}
                    onChange={(event) => setDraftPassingScore(Math.min(100, Math.max(1, Number.parseInt(event.target.value || '80', 10))))}
                    type="number"
                    value={draftPassingScore}
                  />
                </label>
              </div>

              <div className="mt-5 space-y-4">
                {draftQuestions.map((question, index) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={`draft-question-${index}`}>
                    <p className="text-sm font-bold text-slate-900">Question {index + 1}</p>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</span>
                      <textarea
                        className={modalTextareaClass}
                        onChange={(event) => updateQuestion(index, (current) => ({ ...current, prompt: event.target.value }))}
                        value={question.prompt}
                      />
                    </label>

                    <label className="mt-3 block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Choices (one per line)</span>
                      <textarea
                        className={modalTextareaClass}
                        onChange={(event) => {
                          const nextOptions = event.target.value.split('\n').map((line) => line.trim()).filter(Boolean)
                          updateQuestion(index, (current) => ({
                            ...current,
                            options: nextOptions,
                            correctOptionIndex: Math.min(current.correctOptionIndex, Math.max(0, nextOptions.length - 1)),
                          }))
                        }}
                        value={question.options.join('\n')}
                      />
                    </label>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Correct Answer</span>
                        <select
                          className={modalInputClass}
                          onChange={(event) => updateQuestion(index, (current) => ({ ...current, correctOptionIndex: Number.parseInt(event.target.value, 10) || 0 }))}
                          value={question.correctOptionIndex}
                        >
                          {question.options.map((option, optionIndex) => (
                            <option key={`option-${index}-${optionIndex}`} value={optionIndex}>
                              {`Choice ${optionIndex + 1}: ${option || 'Untitled option'}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation</span>
                        <textarea
                          className={modalTextareaClass}
                          onChange={(event) => updateQuestion(index, (current) => ({ ...current, explanation: event.target.value }))}
                          value={question.explanation}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 sm:px-8">
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={() => setIsQuizReviewOpen(false)} type="button">
                  Close Review
                </button>
                <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" disabled={!activeQuiz || saving || loading} onClick={() => void handleSaveDraft()} type="button">
                  Save Draft Edits
                </button>
                <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60" disabled={!activeQuiz || publishing || saving || activeQuiz?.status === 'published'} onClick={() => void handlePublish()} type="button">
                  {publishing ? 'Publishing...' : activeQuiz?.status === 'published' ? 'Published' : 'Publish Quiz'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
