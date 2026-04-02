import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { NavigationBar } from '../../components/NavigationBar'
import { AUTH_CHANGED_EVENT, getCurrentUserProfile, isAuthenticated } from '../../services/auth'
import { getSimulationProgress, saveSimulationProgress } from '../../services/api'
import {
  SIMULATION_COURSES_CHANGED_EVENT,
  getSimulationCourses,
  isEmbeddedVideoUrl,
  type SimulationCourse,
} from '../../services/simulationCourses'

type CourseStatus = 'Not Started' | 'In Progress' | 'Completed'

type ExamAttemptResult = {
  moduleKey: string
  score: number
  total: number
  passed: boolean
  unanswered: number
}

type StoredSimulationProgress = {
  courseProgress: Record<string, number>
  completedLessonVideos: Record<string, boolean>
  completedCourses: Record<string, string>
}

const SIMULATION_PROGRESS_KEY_PREFIX = 'drms-simulation-progress'

function getSimulationProgressStorageKey(): string {
  const profile = getCurrentUserProfile()
  const normalizedEmail = profile?.email?.trim().toLowerCase()
  return `${SIMULATION_PROGRESS_KEY_PREFIX}:${normalizedEmail || 'guest'}`
}

function readStoredSimulationProgress(storageKey: string): StoredSimulationProgress {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return {
        courseProgress: {},
        completedLessonVideos: {},
        completedCourses: {},
      }
    }

    const parsed = JSON.parse(raw) as Partial<StoredSimulationProgress>
    return {
      courseProgress: parsed.courseProgress ?? {},
      completedLessonVideos: parsed.completedLessonVideos ?? {},
      completedCourses: parsed.completedCourses ?? {},
    }
  } catch {
    return {
      courseProgress: {},
      completedLessonVideos: {},
      completedCourses: {},
    }
  }
}

function persistSimulationProgress(storageKey: string, progress: StoredSimulationProgress): void {
  localStorage.setItem(storageKey, JSON.stringify(progress))
}

function mergeProgressSources(localProgress: StoredSimulationProgress, serverProgress: StoredSimulationProgress): StoredSimulationProgress {
  const mergedCourseProgress: Record<string, number> = {
    ...localProgress.courseProgress,
  }

  Object.entries(serverProgress.courseProgress).forEach(([courseId, progress]) => {
    mergedCourseProgress[courseId] = Math.max(mergedCourseProgress[courseId] ?? 0, progress)
  })

  const mergedCompletedLessonVideos: Record<string, boolean> = {
    ...localProgress.completedLessonVideos,
  }

  Object.entries(serverProgress.completedLessonVideos).forEach(([lessonKey, completed]) => {
    mergedCompletedLessonVideos[lessonKey] = Boolean(mergedCompletedLessonVideos[lessonKey] || completed)
  })

  const mergedCompletedCourses: Record<string, string> = {
    ...localProgress.completedCourses,
  }

  Object.entries(serverProgress.completedCourses).forEach(([courseId, completionDate]) => {
    const localDate = mergedCompletedCourses[courseId]
    if (!localDate) {
      mergedCompletedCourses[courseId] = completionDate
      return
    }

    const localTs = Date.parse(localDate)
    const serverTs = Date.parse(completionDate)
    if (!Number.isNaN(serverTs) && (Number.isNaN(localTs) || serverTs > localTs)) {
      mergedCompletedCourses[courseId] = completionDate
    }
  })

  return {
    courseProgress: mergedCourseProgress,
    completedLessonVideos: mergedCompletedLessonVideos,
    completedCourses: mergedCompletedCourses,
  }
}

function getStatusClasses(status: CourseStatus): string {
  if (status === 'In Progress') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (status === 'Completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  return 'border-slate-200 bg-slate-100 text-slate-600'
}

function renderLessonVideo(videoUrl: string, title: string) {
  if (!videoUrl) {
    return (
      <div className="mb-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs font-medium text-slate-500">
        No video has been added for this module yet.
      </div>
    )
  }

  if (isEmbeddedVideoUrl(videoUrl)) {
    return (
      <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-black">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="aspect-video w-full"
          referrerPolicy="strict-origin-when-cross-origin"
          src={videoUrl}
          title={`${title} video`}
        />
      </div>
    )
  }

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-black">
      <video className="aspect-video w-full" controls src={videoUrl}>
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

function getMaterialActionLabel(url: string, fileName?: string): string {
  if (url.startsWith('data:') || fileName) {
    return 'Download material'
  }

  return 'Open material'
}

export function SimulationPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<SimulationCourse[]>(() => getSimulationCourses())
  const [previewCourse, setPreviewCourse] = useState<SimulationCourse | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeLessonIndex, setActiveLessonIndex] = useState(0)
  const [progressStorageKey, setProgressStorageKey] = useState<string>(() => getSimulationProgressStorageKey())
  const [completedLessonVideos, setCompletedLessonVideos] = useState<Record<string, boolean>>(
    () => readStoredSimulationProgress(getSimulationProgressStorageKey()).completedLessonVideos,
  )
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>(
    () => readStoredSimulationProgress(getSimulationProgressStorageKey()).courseProgress,
  )
  const [completedCourses, setCompletedCourses] = useState<Record<string, string>>(
    () => readStoredSimulationProgress(getSimulationProgressStorageKey()).completedCourses,
  )
  const [examSelections, setExamSelections] = useState<Record<string, Record<string, number>>>({})
  const [examAttemptResult, setExamAttemptResult] = useState<ExamAttemptResult | null>(null)
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false)
  const [completedCourseTitle, setCompletedCourseTitle] = useState<string | null>(null)
  const [certificateCourseId, setCertificateCourseId] = useState<string | null>(null)

  useEffect(() => {
    function syncCourses(): void {
      setCourses(getSimulationCourses())
    }

    window.addEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
    return () => window.removeEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
  }, [])

  useEffect(() => {
    let isActive = true

    async function syncProgressBySession(): Promise<void> {
      setHasLoadedProgress(false)

      const nextKey = getSimulationProgressStorageKey()
      const localProgress = readStoredSimulationProgress(nextKey)

      if (!isActive) {
        return
      }

      setProgressStorageKey(nextKey)

      if (!isAuthenticated()) {
        setCourseProgress(localProgress.courseProgress)
        setCompletedLessonVideos(localProgress.completedLessonVideos)
        setCompletedCourses(localProgress.completedCourses)
        setHasLoadedProgress(true)
        return
      }

      try {
        const serverProgress = await getSimulationProgress()
        if (!isActive) {
          return
        }

        const serverSnapshot: StoredSimulationProgress = {
          courseProgress: serverProgress.courseProgress ?? {},
          completedLessonVideos: serverProgress.completedLessonVideos ?? {},
          completedCourses: serverProgress.completedCourses ?? {},
        }

        const mergedProgress = mergeProgressSources(localProgress, serverSnapshot)

        setCourseProgress(mergedProgress.courseProgress)
        setCompletedLessonVideos(mergedProgress.completedLessonVideos)
        setCompletedCourses(mergedProgress.completedCourses)
        persistSimulationProgress(nextKey, mergedProgress)

        void saveSimulationProgress({
          courseProgress: mergedProgress.courseProgress,
          completedLessonVideos: mergedProgress.completedLessonVideos,
          completedCourses: mergedProgress.completedCourses,
        })
      } catch {
        if (!isActive) {
          return
        }

        setCourseProgress(localProgress.courseProgress)
        setCompletedLessonVideos(localProgress.completedLessonVideos)
        setCompletedCourses(localProgress.completedCourses)
      } finally {
        if (isActive) {
          setHasLoadedProgress(true)
        }
      }
    }

    void syncProgressBySession()

    function handleAuthChanged(): void {
      void syncProgressBySession()
    }

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged)
    return () => {
      isActive = false
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged)
    }
  }, [])

  useEffect(() => {
    persistSimulationProgress(progressStorageKey, {
      courseProgress,
      completedLessonVideos,
      completedCourses,
    })

    if (!hasLoadedProgress || !isAuthenticated()) {
      return
    }

    void saveSimulationProgress({
      courseProgress,
      completedLessonVideos,
      completedCourses,
    })
  }, [completedCourses, completedLessonVideos, courseProgress, hasLoadedProgress, progressStorageKey])

  const activeCourse = activeCourseId ? courses.find((course) => course.id === activeCourseId) ?? null : null
  const activeLesson = activeCourse ? activeCourse.lessonOutline[activeLessonIndex] ?? null : null
  const certificateCourse = certificateCourseId ? courses.find((course) => course.id === certificateCourseId) ?? null : null
  const currentUserName = getCurrentUserProfile()?.fullName?.trim() || 'Citizen Learner'
  const currentLessonProgressKey = activeCourse && activeLesson ? getLessonProgressKey(activeCourse.id, activeLesson.id, activeLessonIndex) : null
  const legacyLessonProgressKey = activeCourse ? `${activeCourse.id}:${activeLessonIndex}` : null
  const isCurrentLessonCompleted = currentLessonProgressKey
    ? Boolean(completedLessonVideos[currentLessonProgressKey] || (legacyLessonProgressKey ? completedLessonVideos[legacyLessonProgressKey] : false))
    : false

  useEffect(() => {
    if (!currentLessonProgressKey) {
      setExamAttemptResult(null)
      return
    }

    setExamAttemptResult((previous) => (previous?.moduleKey === currentLessonProgressKey ? previous : null))
  }, [currentLessonProgressKey])

  function getCourseProgressValue(courseId: string): number {
    return courseProgress[courseId] ?? 0
  }

  function getCourseStatus(courseId: string): CourseStatus {
    const progress = getCourseProgressValue(courseId)
    if (progress >= 100) {
      return 'Completed'
    }
    if (progress > 0) {
      return 'In Progress'
    }
    return 'Not Started'
  }

  function getCompletedCourseDateLabel(courseId: string): string | null {
    const rawDate = completedCourses[courseId]
    if (!rawDate) {
      return null
    }

    const parsedDate = new Date(rawDate)
    if (Number.isNaN(parsedDate.getTime())) {
      return null
    }

    return parsedDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function handleMarkCurrentModuleComplete() {
    if (!currentLessonProgressKey) {
      return
    }

    setCompletedLessonVideos((previous) => ({
      ...previous,
      [currentLessonProgressKey]: true,
    }))

  }

  function handleSelectExamOption(questionId: string, optionIndex: number) {
    if (!currentLessonProgressKey) {
      return
    }

    setExamSelections((previous) => ({
      ...previous,
      [currentLessonProgressKey]: {
        ...(previous[currentLessonProgressKey] ?? {}),
        [questionId]: optionIndex,
      },
    }))
  }

  function handleSubmitExam() {
    if (!activeLesson || activeLesson.lessonType !== 'exam' || !currentLessonProgressKey) {
      return
    }

    const selectedAnswers = examSelections[currentLessonProgressKey] ?? {}
    const totalQuestions = activeLesson.examQuestions.length
    const unanswered = activeLesson.examQuestions.filter((question) => selectedAnswers[question.id] === undefined).length

    if (totalQuestions === 0) {
      setExamAttemptResult({
        moduleKey: currentLessonProgressKey,
        score: 0,
        total: 0,
        passed: false,
        unanswered: 0,
      })
      return
    }

    const correctAnswers = activeLesson.examQuestions.reduce((total, question) => {
      return total + (selectedAnswers[question.id] === question.correctOptionIndex ? 1 : 0)
    }, 0)
    const score = Math.round((correctAnswers / totalQuestions) * 100)
    const passed = unanswered === 0 && score >= activeLesson.passingScore

    setExamAttemptResult({
      moduleKey: currentLessonProgressKey,
      score,
      total: totalQuestions,
      passed,
      unanswered,
    })

    if (passed) {
      handleMarkCurrentModuleComplete()
    }
  }

  function updateCourseProgress(courseId: string, lessonIndex: number, markCompleted = false) {
    const targetCourse = courses.find((course) => course.id === courseId)
    if (!targetCourse) {
      return
    }

    setCourseProgress((previous) => {
      const progressFromLesson = markCompleted ? 100 : Math.round(((lessonIndex + 1) / targetCourse.lessonOutline.length) * 100)
      return {
        ...previous,
        [courseId]: Math.max(previous[courseId] ?? 0, progressFromLesson),
      }
    })
  }

  function handleStartSimulation(courseId: string) {
    if (!isAuthenticated()) {
      navigate('/login', { state: { from: '/simulation' } })
      return
    }

    if (getCourseStatus(courseId) === 'Completed') {
      setCertificateCourseId(courseId)
      return
    }

    setPreviewCourse(null)
    setActiveCourseId(courseId)
    setActiveLessonIndex(0)
    updateCourseProgress(courseId, 0)
  }

  function handleNextLesson() {
    if (!activeCourse) {
      return
    }

    if (!isCurrentLessonCompleted) {
      return
    }

    if (activeLessonIndex >= activeCourse.lessonOutline.length - 1) {
      return
    }

    const nextLessonIndex = activeLessonIndex + 1
    setActiveLessonIndex(nextLessonIndex)
    updateCourseProgress(activeCourse.id, nextLessonIndex)
  }

  function handlePreviousLesson() {
    if (activeLessonIndex <= 0) {
      return
    }

    setActiveLessonIndex((previous) => previous - 1)
  }

  function handleCompleteCourse() {
    if (!activeCourse) {
      return
    }

    if (!isCurrentLessonCompleted) {
      return
    }

    updateCourseProgress(activeCourse.id, activeCourse.lessonOutline.length - 1, true)
    setCompletedCourses((previous) => ({
      ...previous,
      [activeCourse.id]: new Date().toISOString(),
    }))
    setCompletedCourseTitle(activeCourse.title)
    setActiveCourseId(null)
    setActiveLessonIndex(0)
  }

  function handleExitCourse() {
    setActiveCourseId(null)
    setActiveLessonIndex(0)
    setExamAttemptResult(null)
  }

  function handleDownloadCertificatePdf(course: SimulationCourse) {
    const completionDate = getCompletedCourseDateLabel(course.id) || 'Completed'
    const learnerName = currentUserName
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setDrawColor(11, 42, 87)
    doc.setLineWidth(1.6)
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20)

    doc.setLineWidth(0.4)
    doc.rect(14, 14, pageWidth - 28, pageHeight - 28)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(11, 42, 87)
    doc.text('DISASTER READINESS SIMULATION ACADEMY', pageWidth / 2, 30, { align: 'center' })

    doc.setFontSize(32)
    doc.text('Certificate of Completion', pageWidth / 2, 48, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(71, 85, 105)
    doc.text('This certifies that', pageWidth / 2, 64, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(15, 23, 42)
    doc.text(learnerName, pageWidth / 2, 80, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(71, 85, 105)
    doc.text('has successfully completed the course', pageWidth / 2, 94, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(11, 42, 87)
    doc.text(course.title, pageWidth / 2, 108, { align: 'center', maxWidth: pageWidth - 48 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(13)
    doc.setTextColor(51, 65, 85)
    doc.text(`Completion Date: ${completionDate}`, pageWidth / 2, 124, { align: 'center' })

    doc.line(36, 155, 110, 155)
    doc.line(pageWidth - 110, 155, pageWidth - 36, 155)

    doc.setFontSize(11)
    doc.text('Course Coordinator', 73, 162, { align: 'center' })
    doc.text('Authorized Signature', pageWidth - 73, 162, { align: 'center' })

    const fileName = `certificate-${course.id}-${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(fileName)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#d5e7ff_0%,#f6f7fb_42%,#fff8ef_100%)] text-slate-800">
      <NavigationBar variant="hero" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-10 pt-7 sm:px-10 sm:pt-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-300/60 bg-white/80 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-[#0b2a57]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-12 h-56 w-56 rounded-full bg-orange-300/25 blur-3xl" />

          <div className="relative">
            <div>
              <p className="inline-flex rounded-full border border-[#0b2a57]/20 bg-[#0b2a57]/5 px-4 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#0b2a57]">
                Simulation Academy
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Hands-on Disaster Readiness Courses
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Train with real-world style scenarios, review learning materials, and complete every module at your own pace. You can explore freely, then sign in when you are ready to start.
              </p>
            </div>
          </div>
        </section>

        <section className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <article
              className="group relative flex h-full min-h-[38rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_14px_28px_rgba(15,23,42,0.1)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_rgba(15,23,42,0.16)] sm:p-6"
              key={course.id}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: course.accent }} />
              <div className="-mx-5 -mt-5 mb-5 h-40 overflow-hidden border-b border-slate-200 sm:-mx-6 sm:-mt-6">
                {course.heroImageUrl ? (
                  <img alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={course.heroImageUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#e1edff_0%,#fef3e7_100%)] px-6 text-center text-sm font-semibold text-slate-500">
                    No course cover image yet
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${getStatusClasses(getCourseStatus(course.id))}`}>
                  {getCourseStatus(course.id)}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                  {course.duration}
                </span>
              </div>

              {getCompletedCourseDateLabel(course.id) ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700">Completed on {getCompletedCourseDateLabel(course.id)}</p>
              ) : null}

              <h2 className="mt-4 min-h-[3.75rem] text-2xl font-black leading-tight text-slate-900">{course.title}</h2>
              <p className="mt-2 min-h-[4.5rem] text-sm leading-relaxed text-slate-600">{course.description}</p>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Modules</p>
                  <p className="mt-1 text-base font-black text-slate-900">{course.lessonOutline.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Progress</p>
                  <p className="mt-1 text-base font-black text-slate-900">{getCourseProgressValue(course.id)}%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Materials</p>
                  <p className="mt-1 text-base font-black text-slate-900">{course.learningMaterials.length}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span>Course Completion</span>
                  <span>{getCourseProgressValue(course.id)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: course.accent, width: `${getCourseProgressValue(course.id)}%` }} />
                </div>
              </div>

              <div className="mt-auto grid grid-cols-1 gap-2 pt-5">
                <button
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-white transition sm:text-sm ${
                    getCourseStatus(course.id) === 'Completed'
                      ? 'bg-[linear-gradient(135deg,#047857,#10b981)] hover:brightness-110'
                      : 'bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] hover:brightness-110'
                  }`}
                  onClick={() => handleStartSimulation(course.id)}
                  type="button"
                >
                  {getCourseStatus(course.id) === 'Completed' ? 'Open Certificate' : 'Start Course'}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-[#0b2a57]/20 bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_45%,#fff6ea_100%)] px-5 py-4 text-xs text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.08)] sm:text-sm">
          Tip: You can review all modules without logging in. Sign in begins only when you press <span className="font-bold text-slate-800">Start Course</span>.
        </section>
      </div>

      {previewCourse ? (
        <div className="fixed inset-0 z-[1300] overflow-y-auto bg-[#041225]/55 p-4 backdrop-blur-[2px] sm:p-8" onClick={() => setPreviewCourse(null)}>
          <div className="mx-auto mt-8 w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <section className="max-h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-[0_30px_54px_rgba(2,6,23,0.45)]">
              {previewCourse.heroImageUrl ? (
                <img alt={previewCourse.title} className="h-48 w-full object-cover" src={previewCourse.heroImageUrl} />
              ) : (
                <div className="flex h-48 items-center justify-center bg-[linear-gradient(135deg,#e1edff_0%,#fef3e7_100%)] px-6 text-center text-sm font-semibold text-slate-500">
                  No course cover image yet
                </div>
              )}
              <div className="p-5 sm:p-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0b2a57]">Simulation Preview</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{previewCourse.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{previewCourse.description}</p>
                {previewCourse.audience ? <p className="mt-2 text-sm leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">For:</span> {previewCourse.audience}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.lessonOutline.length} Modules
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.duration}
                  </span>
                </div>

                {(previewCourse.objectives.length > 0 || previewCourse.prerequisites.length > 0) ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Learning Objectives</p>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        {previewCourse.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Prerequisites</p>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        {previewCourse.prerequisites.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Course Modules</p>
                  {previewCourse.lessonOutline.map((lesson) => (
                    <div key={lesson.title}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          {getLessonTypeLabel(lesson.lessonType)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {lesson.duration}
                        </span>
                      </div>
                      {lesson.lessonType === 'video' ? renderLessonVideo(lesson.videoUrl, lesson.title) : null}
                      <p className="text-sm font-semibold text-slate-800">{lesson.title}</p>
                      {lesson.videoFileName ? <p className="mt-1 text-[11px] text-slate-400">Stored file: {lesson.videoFileName}</p> : null}
                      {lesson.summary ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{lesson.summary}</p> : null}
                      {lesson.lessonType === 'lesson' && lesson.content ? (
                        <p className="mt-2 whitespace-pre-line text-xs text-slate-600 sm:text-sm">{lesson.content}</p>
                      ) : null}
                      {lesson.lessonType === 'exam' ? (
                        <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                          {lesson.examQuestions.length} questions • Passing score {lesson.passingScore}%
                        </p>
                      ) : null}
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600 sm:text-sm">
                        {lesson.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Learning Materials</p>
                  {previewCourse.learningMaterials.length > 0 ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {previewCourse.learningMaterials.map((material) => (
                        <article className="rounded-xl border border-slate-200 bg-white p-3" key={material.id}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2a57]">{material.type}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-800">{material.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{material.description || 'No description added yet.'}</p>
                          {material.fileName ? <p className="mt-2 text-[11px] text-slate-400">Stored file: {material.fileName}</p> : null}
                          {material.url ? (
                            <a className="mt-3 inline-flex text-xs font-semibold text-[#0b2a57] hover:text-[#123a73] sm:text-sm" download={material.fileName || undefined} href={material.url} rel="noreferrer" target="_blank">
                              {getMaterialActionLabel(material.url, material.fileName)}
                            </a>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">No material link added yet.</p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No learning materials have been added yet.</p>
                  )}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
                    onClick={() => setPreviewCourse(null)}
                    type="button"
                  >
                    Close
                  </button>
                  <button
                    className="rounded-xl bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                    onClick={() => handleStartSimulation(previewCourse.id)}
                    type="button"
                  >
                    Start Course
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeCourse ? (
        <div className="fixed inset-0 z-[1400] overflow-y-auto bg-[#031022]/65 p-4 backdrop-blur-[2px] sm:p-8" onClick={handleExitCourse}>
          <div className="mx-auto mt-6 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <section className="max-h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-[0_30px_54px_rgba(2,6,23,0.5)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff,#eef5ff)] px-5 py-4 sm:px-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0b2a57]">Simulation Session</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{activeCourse.title}</h3>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Module {activeLessonIndex + 1} of {activeCourse.lessonOutline.length}
                </p>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full"
                    style={{ backgroundColor: activeCourse.accent, width: `${Math.round(((activeLessonIndex + 1) / activeCourse.lessonOutline.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                {activeLesson ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                        {getLessonTypeLabel(activeLesson.lessonType)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {activeLesson.duration}
                      </span>
                    </div>

                    {activeLesson.lessonType === 'video' ? renderLessonVideo(activeLesson.videoUrl, activeLesson.title) : null}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                      <p className="text-sm font-semibold text-slate-900">{activeLesson.title}</p>
                      {activeLesson.videoFileName ? <p className="mt-1 text-xs text-slate-400">Stored file: {activeLesson.videoFileName}</p> : null}
                      {activeLesson.summary ? <p className="mt-1 text-sm text-slate-500">{activeLesson.summary}</p> : null}
                      {activeLesson.points.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                          {activeLesson.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      ) : null}
                      {activeLesson.lessonType === 'lesson' && activeLesson.content ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                          <p className="whitespace-pre-line">{activeLesson.content}</p>
                        </div>
                      ) : null}
                    </div>

                    {activeLesson.lessonType === 'exam' ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Module Exam</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {activeLesson.examQuestions.length} questions • Passing score {activeLesson.passingScore}%
                            </p>
                          </div>
                          <button
                            className="rounded-xl bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                            onClick={handleSubmitExam}
                            type="button"
                          >
                            Submit Exam
                          </button>
                        </div>

                        {activeLesson.examQuestions.length > 0 ? (
                          <div className="mt-4 space-y-4">
                            {activeLesson.examQuestions.map((question, questionIndex) => {
                              const selectedAnswer = currentLessonProgressKey ? examSelections[currentLessonProgressKey]?.[question.id] : undefined
                              const showExplanation = Boolean(examAttemptResult)
                              const isCorrect = selectedAnswer === question.correctOptionIndex

                              return (
                                <article className="rounded-xl border border-slate-200 bg-white p-4" key={question.id}>
                                  <p className="text-sm font-semibold text-slate-900">Question {questionIndex + 1}</p>
                                  <p className="mt-1 text-sm text-slate-700">{question.prompt}</p>

                                  <div className="mt-3 space-y-2">
                                    {question.options.map((option, optionIndex) => (
                                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" key={`${question.id}-${optionIndex}`}>
                                        <input
                                          checked={selectedAnswer === optionIndex}
                                          className="mt-0.5 h-4 w-4"
                                          name={question.id}
                                          onChange={() => handleSelectExamOption(question.id, optionIndex)}
                                          type="radio"
                                        />
                                        <span>{option}</span>
                                      </label>
                                    ))}
                                  </div>

                                  {showExplanation && selectedAnswer !== undefined ? (
                                    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                                      <p className="font-semibold">{isCorrect ? 'Correct' : 'Incorrect'}</p>
                                      {question.explanation ? <p className="mt-1">{question.explanation}</p> : null}
                                    </div>
                                  ) : null}
                                </article>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">No exam questions have been added for this module yet.</p>
                        )}

                        {examAttemptResult ? (
                          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${examAttemptResult.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                            <p className="font-semibold">
                              {examAttemptResult.passed
                                ? `Passed with ${examAttemptResult.score}%`
                                : examAttemptResult.unanswered > 0
                                  ? `Answer all questions first. ${examAttemptResult.unanswered} remaining.`
                                  : `Score: ${examAttemptResult.score}% of ${activeLesson.passingScore}% required.`}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Learning Materials</p>
                    <span className="text-xs text-slate-500">{activeCourse.learningMaterials.length} available</span>
                  </div>
                  {activeCourse.learningMaterials.length > 0 ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {activeCourse.learningMaterials.map((material) => (
                        <article className="rounded-xl border border-slate-200 bg-white p-3" key={material.id}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2a57]">{material.type}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{material.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{material.description || 'No description added yet.'}</p>
                          {material.fileName ? <p className="mt-2 text-[11px] text-slate-400">Stored file: {material.fileName}</p> : null}
                          {material.url ? (
                            <a className="mt-3 inline-flex text-xs font-semibold text-[#0b2a57] hover:text-[#123a73]" download={material.fileName || undefined} href={material.url} rel="noreferrer" target="_blank">
                              {getMaterialActionLabel(material.url, material.fileName)}
                            </a>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">No material link added yet.</p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No learning materials have been added for this course yet.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isCurrentLessonCompleted && activeLesson?.lessonType !== 'exam' ? (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                      <p className="text-xs font-semibold text-amber-700">
                        {activeLesson?.lessonType === 'lesson'
                          ? 'Review the lesson content, then confirm to unlock the next module.'
                          : 'Finish watching the video, then confirm to unlock the next module.'}
                      </p>
                      <button
                        className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-amber-800 transition hover:bg-amber-100"
                        onClick={handleMarkCurrentModuleComplete}
                        type="button"
                      >
                        {activeLesson?.lessonType === 'lesson' ? 'I finished reading this lesson' : 'I finished this lesson video'}
                      </button>
                    </div>
                  ) : null}

                  {!isCurrentLessonCompleted && activeLesson?.lessonType === 'exam' ? (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold text-amber-700">
                      Pass the exam to unlock the next module.
                    </div>
                  ) : null}

                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeLessonIndex === 0}
                    onClick={handlePreviousLesson}
                    type="button"
                  >
                    Previous
                  </button>

                  {activeLessonIndex < activeCourse.lessonOutline.length - 1 ? (
                    <button
                      className="rounded-xl bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:brightness-90"
                      disabled={!isCurrentLessonCompleted}
                      onClick={handleNextLesson}
                      type="button"
                    >
                      Next Module
                    </button>
                  ) : (
                    <button
                      className="rounded-xl bg-[linear-gradient(135deg,#059669,#10b981)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:brightness-90"
                      disabled={!isCurrentLessonCompleted}
                      onClick={handleCompleteCourse}
                      type="button"
                    >
                      Complete Course
                    </button>
                  )}

                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
                    onClick={handleExitCourse}
                    type="button"
                  >
                    Exit
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {completedCourseTitle ? (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-[#031022]/60 p-4 backdrop-blur-[2px] sm:p-8" onClick={() => setCompletedCourseTitle(null)}>
          <section className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-[0_30px_54px_rgba(2,6,23,0.45)] sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg aria-hidden className="h-8 w-8" fill="none" viewBox="0 0 24 24">
                <path d="m5 12 4 4L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
              </svg>
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Course Complete</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">Congratulations!</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              You have successfully completed <span className="font-bold text-slate-800">{completedCourseTitle}</span>.
            </p>
            <button
              className="mt-6 rounded-xl bg-[linear-gradient(135deg,#059669,#10b981)] px-5 py-2.5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
              onClick={() => setCompletedCourseTitle(null)}
              type="button"
            >
              Nice!
            </button>
          </section>
        </div>
      ) : null}

      {certificateCourse ? (
        <div className="fixed inset-0 z-[1510] flex items-center justify-center bg-[#031022]/60 p-4 backdrop-blur-[2px] sm:p-8" onClick={() => setCertificateCourseId(null)}>
          <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#0b2a57]/20 bg-white shadow-[0_30px_54px_rgba(2,6,23,0.5)]" onClick={(event) => event.stopPropagation()}>
            <div className="bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] px-6 py-5 text-white sm:px-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">Certificate of Completion</p>
              <h3 className="mt-2 text-2xl font-black">Disaster Readiness Simulation Academy</h3>
            </div>
            <div className="space-y-4 px-6 py-7 text-center sm:px-8">
              <p className="text-sm uppercase tracking-[0.16em] text-slate-500">This certifies that</p>
              <p className="text-3xl font-black text-slate-900 sm:text-4xl">{currentUserName}</p>
              <p className="text-sm uppercase tracking-[0.16em] text-slate-500">has successfully completed</p>
              <p className="text-xl font-extrabold text-[#0b2a57] sm:text-2xl">{certificateCourse.title}</p>
              <p className="text-sm text-slate-600">
                Completion Date: <span className="font-bold text-slate-800">{getCompletedCourseDateLabel(certificateCourse.id) || 'Completed'}</span>
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  className="rounded-xl bg-[linear-gradient(135deg,#0b2a57,#1a4a8c)] px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-110"
                  onClick={() => handleDownloadCertificatePdf(certificateCourse)}
                  type="button"
                >
                  Download PDF
                </button>
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setCertificateCourseId(null)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function getLessonProgressKey(courseId: string, lessonId: string, lessonIndex: number): string {
  return lessonId ? `${courseId}:${lessonId}` : `${courseId}:${lessonIndex}`
}

function getLessonTypeLabel(lessonType: 'video' | 'lesson' | 'exam'): string {
  if (lessonType === 'lesson') {
    return 'Text Lesson'
  }

  if (lessonType === 'exam') {
    return 'Exam'
  }

  return 'Video Lesson'
}