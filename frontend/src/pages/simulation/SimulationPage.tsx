import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavigationBar } from '../../components/NavigationBar'
import { isAuthenticated } from '../../services/auth'
import {
  SIMULATION_COURSES_CHANGED_EVENT,
  getSimulationCourses,
  isEmbeddedVideoUrl,
  type SimulationCourse,
  type SimulationCourseDifficulty,
} from '../../services/simulationCourses'

type CourseStatus = 'Not Started' | 'In Progress' | 'Completed'

function getDifficultyClasses(difficulty: SimulationCourseDifficulty): string {
  if (difficulty === 'Beginner') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (difficulty === 'Intermediate') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border-red-200 bg-red-50 text-red-700'
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

function CourseIcon({ courseId }: { courseId: string }) {
  if (courseId === 'earthquake') {
    return (
      <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (courseId === 'fire') {
    return (
      <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="M12 3c2 3 1 4 0 6 3-1 5 2 5 5a5 5 0 1 1-10 0c0-2 1-4 3-6 1 2 1 3 2 4 1-3 0-5 0-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 14h3l2-3 3 6 2-3h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.8" width="20" x="2" y="7" />
    </svg>
  )
}

function renderLessonVideo(videoUrl: string, title: string) {
  if (!videoUrl) {
    return (
      <div className="mb-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs font-medium text-slate-500">
        No lesson video has been added yet.
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
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeLessonIndex, setActiveLessonIndex] = useState(0)
  const [completedLessonVideos, setCompletedLessonVideos] = useState<Record<string, boolean>>({})
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    function syncCourses(): void {
      setCourses(getSimulationCourses())
    }

    window.addEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
    return () => window.removeEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
  }, [])

  const preparednessStats = useMemo(
    () => [
      { label: 'Total Registered Trainees', value: courses.reduce((total, course) => total + course.trainees, 0).toLocaleString() },
      { label: 'Completed Courses', value: String(Object.values(courseProgress).filter((progress) => progress >= 100).length) },
      { label: 'Active Simulations', value: String(courses.length) },
      {
        label: 'Preparedness Score',
        value: `${courses.length > 0 ? Math.round(courses.reduce((total, course) => total + course.completionRate, 0) / courses.length) : 0}%`,
      },
    ],
    [courseProgress, courses],
  )

  const activeCourse = activeCourseId ? courses.find((course) => course.id === activeCourseId) ?? null : null
  const currentLessonVideoKey = activeCourse ? `${activeCourse.id}:${activeLessonIndex}` : null
  const isCurrentLessonVideoCompleted = currentLessonVideoKey ? Boolean(completedLessonVideos[currentLessonVideoKey]) : false

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

  function handleMarkLessonVideoComplete() {
    if (!currentLessonVideoKey) {
      return
    }

    setCompletedLessonVideos((previous) => ({
      ...previous,
      [currentLessonVideoKey]: true,
    }))
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

    setPreviewCourse(null)
    setExpandedCourseId(courseId)
    setActiveCourseId(courseId)
    setActiveLessonIndex(0)
    updateCourseProgress(courseId, 0)
  }

  function handleNextLesson() {
    if (!activeCourse) {
      return
    }

    if (!isCurrentLessonVideoCompleted) {
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

    if (!isCurrentLessonVideoCompleted) {
      return
    }

    updateCourseProgress(activeCourse.id, activeCourse.lessonOutline.length - 1, true)
    setActiveCourseId(null)
    setActiveLessonIndex(0)
  }

  function handleExitCourse() {
    setActiveCourseId(null)
    setActiveLessonIndex(0)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f2ff_0%,#f4f8ff_42%,#f8fafc_100%)] text-slate-800">
      <NavigationBar variant="hero" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-6 py-8 sm:px-10 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.11)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#0b2a57]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-0 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />

          <p className="inline-flex rounded-full border border-[#0b2a57]/20 bg-[#0b2a57]/5 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#0b2a57]">
            Simulation Academy
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">Disaster Readiness Courses</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Cisco-inspired course flow for hands-on preparedness. You can browse all modules freely. Login is only required once you begin a simulation course.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.1)] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0b2a57]">Community Preparedness Dashboard</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {preparednessStats.map((stat) => (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" key={stat.label}>
                <p className="text-2xl font-black tracking-tight text-slate-900">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">{stat.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {courses.map((course) => (
            <article
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_26px_rgba(15,23,42,0.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.14)] sm:p-6"
              key={course.id}
            >
              <div className="-mx-5 -mt-5 mb-4 h-36 overflow-hidden border-b border-slate-200 sm:-mx-6 sm:-mt-6">
                {course.heroImageUrl ? (
                  <img alt={course.title} className="h-full w-full object-cover" src={course.heroImageUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#f8fafc_100%)] px-6 text-center text-sm font-semibold text-slate-500">
                    No course cover image yet
                  </div>
                )}
              </div>

              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: `linear-gradient(90deg, ${course.accent}, transparent)` }}
              />

              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  <CourseIcon courseId={course.id} />
                  {course.tag}
                </span>
                <span className="text-xs font-semibold text-slate-500">{course.duration}</span>
              </div>

              <h2 className="mt-4 text-xl font-black leading-tight text-slate-900">{course.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{course.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 font-semibold ${getDifficultyClasses(course.difficulty)}`}>
                  Level: {course.difficulty}
                </span>
                <span className={`rounded-full border px-2.5 py-1 font-semibold ${getStatusClasses(getCourseStatus(course.id))}`}>
                  {getCourseStatus(course.id)}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>
                  <span className="font-semibold text-slate-700">Lessons:</span> {course.lessonOutline.length}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Progress:</span> {getCourseProgressValue(course.id)}%
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Learning Materials:</span> {course.learningMaterials.length}
                </p>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: course.accent, width: `${getCourseProgressValue(course.id)}%` }}
                />
              </div>

              <button
                className="mt-4 text-xs font-semibold text-[#0b2a57] underline decoration-[#0b2a57]/40 underline-offset-2 transition hover:text-[#123a73]"
                onClick={() => setExpandedCourseId((previous) => (previous === course.id ? null : course.id))}
                type="button"
              >
                {expandedCourseId === course.id ? 'Hide Lessons' : 'View Lessons'}
              </button>

              {expandedCourseId === course.id ? (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {course.lessonOutline.map((lesson) => (
                    <div key={lesson.title}>
                      <p className="text-xs font-semibold text-slate-800">{lesson.title}</p>
                      {lesson.summary ? <p className="mt-1 text-[11px] text-slate-500">{lesson.summary}</p> : null}
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
                        {lesson.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-[#0b2a57]/20 bg-[#0b2a57]/5 px-3 py-2.5 text-xs font-semibold text-[#0b2a57] transition hover:bg-[#0b2a57]/10 sm:text-sm"
                  onClick={() => setPreviewCourse(course)}
                  type="button"
                >
                  Preview Simulation
                </button>
                <button
                  className="rounded-xl bg-[#0b2a57] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#123a73] sm:text-sm"
                  onClick={() => handleStartSimulation(course.id)}
                  type="button"
                >
                  Start Course
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.08)] sm:text-sm">
          Tip: Guest users can review all course modules. Sign in begins only when you press <span className="font-semibold text-slate-800">Start Course</span>.
        </section>
      </div>

      {previewCourse ? (
        <div className="fixed inset-0 z-[1300] bg-slate-900/40 p-4 backdrop-blur-[1px] sm:p-8" onClick={() => setPreviewCourse(null)}>
          <div className="mx-auto mt-8 w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.25)]">
              {previewCourse.heroImageUrl ? (
                <img alt={previewCourse.title} className="h-48 w-full object-cover" src={previewCourse.heroImageUrl} />
              ) : (
                <div className="flex h-48 items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#f8fafc_100%)] px-6 text-center text-sm font-semibold text-slate-500">
                  No course cover image yet
                </div>
              )}
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b2a57]">Simulation Preview</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{previewCourse.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{previewCourse.description}</p>
                {previewCourse.audience ? <p className="mt-2 text-sm leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">For:</span> {previewCourse.audience}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${getDifficultyClasses(previewCourse.difficulty)}`}>
                    {previewCourse.difficulty}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.lessonOutline.length} Lessons
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.duration}
                  </span>
                </div>

                {(previewCourse.objectives.length > 0 || previewCourse.prerequisites.length > 0) ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Learning Objectives</p>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        {previewCourse.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Prerequisites</p>
                      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                        {previewCourse.prerequisites.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Course Lessons</p>
                  {previewCourse.lessonOutline.map((lesson) => (
                    <div key={lesson.title}>
                      {renderLessonVideo(lesson.videoUrl, lesson.title)}
                      <p className="text-sm font-semibold text-slate-800">{lesson.title}</p>
                      {lesson.videoFileName ? <p className="mt-1 text-[11px] text-slate-400">Stored file: {lesson.videoFileName}</p> : null}
                      {lesson.summary ? <p className="mt-1 text-xs text-slate-500 sm:text-sm">{lesson.summary}</p> : null}
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600 sm:text-sm">
                        {lesson.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => setPreviewCourse(null)}
                    type="button"
                  >
                    Close
                  </button>
                  <button
                    className="rounded-xl bg-[#0b2a57] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123a73]"
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
        <div className="fixed inset-0 z-[1400] bg-slate-950/55 p-4 backdrop-blur-[2px] sm:p-8" onClick={handleExitCourse}>
          <div className="mx-auto mt-6 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.32)]">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b2a57]">Simulation Session</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{activeCourse.title}</h3>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Lesson {activeLessonIndex + 1} of {activeCourse.lessonOutline.length}
                </p>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full"
                    style={{ backgroundColor: activeCourse.accent, width: `${Math.round(((activeLessonIndex + 1) / activeCourse.lessonOutline.length) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                {renderLessonVideo(activeCourse.lessonOutline[activeLessonIndex].videoUrl, activeCourse.lessonOutline[activeLessonIndex].title)}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{activeCourse.lessonOutline[activeLessonIndex].title}</p>
                  {activeCourse.lessonOutline[activeLessonIndex].videoFileName ? (
                    <p className="mt-1 text-xs text-slate-400">Stored file: {activeCourse.lessonOutline[activeLessonIndex].videoFileName}</p>
                  ) : null}
                  {activeCourse.lessonOutline[activeLessonIndex].summary ? (
                    <p className="mt-1 text-sm text-slate-500">{activeCourse.lessonOutline[activeLessonIndex].summary}</p>
                  ) : null}
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                    {activeCourse.lessonOutline[activeLessonIndex].points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                  {!isCurrentLessonVideoCompleted ? (
                    <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <p className="text-xs font-semibold text-amber-700">Finish watching the video, then confirm to unlock next lesson.</p>
                      <button
                        className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        onClick={handleMarkLessonVideoComplete}
                        type="button"
                      >
                        I finished this lesson video
                      </button>
                    </div>
                  ) : null}

                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeLessonIndex === 0}
                    onClick={handlePreviousLesson}
                    type="button"
                  >
                    Previous
                  </button>

                  {activeLessonIndex < activeCourse.lessonOutline.length - 1 ? (
                    <button
                      className="rounded-xl bg-[#0b2a57] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123a73] disabled:cursor-not-allowed disabled:bg-[#7f93b2]"
                      disabled={!isCurrentLessonVideoCompleted}
                      onClick={handleNextLesson}
                      type="button"
                    >
                      Next Lesson
                    </button>
                  ) : (
                    <button
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      disabled={!isCurrentLessonVideoCompleted}
                      onClick={handleCompleteCourse}
                      type="button"
                    >
                      Complete Course
                    </button>
                  )}

                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
    </main>
  )
}