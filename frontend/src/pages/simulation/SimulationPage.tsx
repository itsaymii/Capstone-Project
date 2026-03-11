import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavigationBar } from '../../components/NavigationBar'
import { isAuthenticated } from '../../services/auth'

type CourseStatus = 'Not Started' | 'In Progress' | 'Completed'
type CourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

type SimulationCourse = {
  id: string
  title: string
  tag: string
  difficulty: CourseDifficulty
  duration: string
  lessons: number
  progress: number
  status: CourseStatus
  description: string
  accent: string
  imageUrl: string
  lessonOutline: Array<{
    title: string
    videoUrl: string
    points: string[]
  }>
}

const preparednessStats = [
  { label: 'Total Registered Trainees', value: '2,431' },
  { label: 'Completed Courses', value: '1,892' },
  { label: 'Active Simulations', value: '6' },
  { label: 'Preparedness Score', value: '82%' },
]

const initialSimulationCourses: SimulationCourse[] = [
  {
    id: 'earthquake',
    title: 'Earthquake Response Course',
    tag: 'Seismic Training',
    difficulty: 'Beginner',
    duration: '35 min',
    lessons: 3,
    progress: 0,
    status: 'Not Started',
    description: 'Practice early warning response, safe shelter decisions, and post-quake damage reporting drills.',
    accent: '#f59e0b',
    imageUrl:
      'https://images.unsplash.com/photo-1508182314998-3bd49473002f?auto=format&fit=crop&w=1000&q=80',
    lessonOutline: [
      {
        title: 'Lesson 1 - Before an Earthquake',
        videoUrl: 'https://www.youtube.com/embed/BLEPakj1YTY',
        points: [
          'Prepare an emergency kit (water, flashlight, first aid).',
          'Identify safe spots at home, such as under a sturdy table.',
        ],
      },
      {
        title: 'Lesson 2 - During an Earthquake',
        videoUrl: 'https://www.youtube.com/embed/4WfA7xri9Kk',
        points: ['Perform Drop, Cover, and Hold.', 'Stay away from windows and tall furniture.'],
      },
      {
        title: 'Lesson 3 - After an Earthquake',
        videoUrl: 'https://www.youtube.com/embed/Cz4N6A8x5q8',
        points: ['Check if anyone is injured.', 'Evacuate calmly and proceed to the evacuation area.'],
      },
    ],
  },
  {
    id: 'fire',
    title: 'Fire Emergency Course',
    tag: 'Fire Suppression',
    difficulty: 'Intermediate',
    duration: '40 min',
    lessons: 3,
    progress: 46,
    status: 'In Progress',
    description: 'Run scenario-based evacuation paths, extinguisher choices, and coordination with fire response teams.',
    accent: '#ef4444',
    imageUrl:
      'https://images.unsplash.com/photo-1578825922519-485b4dd5c533?auto=format&fit=crop&w=1000&q=80',
    lessonOutline: [
      {
        title: 'Lesson 1 - Preventing Fire',
        videoUrl: 'https://www.youtube.com/embed/woLrY8J6f4g',
        points: ['Check wiring and appliances regularly.', 'Do not leave cooking unattended.'],
      },
      {
        title: 'Lesson 2 - During a Fire',
        videoUrl: 'https://www.youtube.com/embed/7nL10C7FSbE',
        points: ['Evacuate immediately using the nearest exit.', 'Crawl low when smoke is thick.'],
      },
      {
        title: 'Lesson 3 - Call for Help',
        videoUrl: 'https://www.youtube.com/embed/gxAA3gS8qzY',
        points: ['Call the fire department.', 'Provide the exact location of the fire.'],
      },
    ],
  },
  {
    id: 'accidents',
    title: 'Road Accident Course',
    tag: 'Traffic Triage',
    difficulty: 'Advanced',
    duration: '30 min',
    lessons: 3,
    progress: 100,
    status: 'Completed',
    description: 'Train incident scene control, first-response triage basics, and rapid escalation procedures.',
    accent: '#0ea5e9',
    imageUrl:
      'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1000&q=80',
    lessonOutline: [
      {
        title: 'Lesson 1 - Stay Safe',
        videoUrl: 'https://www.youtube.com/embed/qxVYg6R3x9I',
        points: ['Move away from traffic immediately.', 'Turn on hazard lights if you are the driver.'],
      },
      {
        title: 'Lesson 2 - Help the Injured',
        videoUrl: 'https://www.youtube.com/embed/5V2Vx4HjK8s',
        points: ['Check if the victim is conscious.', 'Control bleeding if it is safe and possible.'],
      },
      {
        title: 'Lesson 3 - Report the Incident',
        videoUrl: 'https://www.youtube.com/embed/9j7M6vN2wL0',
        points: ['Call an ambulance or police.', 'Report clear details of the incident location.'],
      },
    ],
  },
]

function getDifficultyClasses(difficulty: CourseDifficulty): string {
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

export function SimulationPage() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<SimulationCourse[]>(initialSimulationCourses)
  const [previewCourse, setPreviewCourse] = useState<SimulationCourse | null>(null)
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeLessonIndex, setActiveLessonIndex] = useState(0)
  const [completedLessonVideos, setCompletedLessonVideos] = useState<Record<string, boolean>>({})

  const activeCourse = activeCourseId ? courses.find((course) => course.id === activeCourseId) ?? null : null
  const currentLessonVideoKey = activeCourse ? `${activeCourse.id}:${activeLessonIndex}` : null
  const isCurrentLessonVideoCompleted = currentLessonVideoKey ? Boolean(completedLessonVideos[currentLessonVideoKey]) : false

  function handleMarkLessonVideoComplete() {
    if (!currentLessonVideoKey) {
      return
    }

    setCompletedLessonVideos((previous) => ({
      ...previous,
      [currentLessonVideoKey]: true,
    }))
  }

  function setCourseProgress(courseId: string, lessonIndex: number, markCompleted = false) {
    setCourses((previousCourses) =>
      previousCourses.map((course) => {
        if (course.id !== courseId) {
          return course
        }

        if (markCompleted) {
          return {
            ...course,
            progress: 100,
            status: 'Completed',
          }
        }

        const progressFromLesson = Math.round(((lessonIndex + 1) / course.lessonOutline.length) * 100)
        return {
          ...course,
          progress: Math.max(course.progress, progressFromLesson),
          status: 'In Progress',
        }
      }),
    )
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
    setCourseProgress(courseId, 0)
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
    setCourseProgress(activeCourse.id, nextLessonIndex)
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

    setCourseProgress(activeCourse.id, activeCourse.lessonOutline.length - 1, true)
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
                <img alt={course.title} className="h-full w-full object-cover" src={course.imageUrl} />
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
                <span className={`rounded-full border px-2.5 py-1 font-semibold ${getStatusClasses(course.status)}`}>
                  {course.status}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>
                  <span className="font-semibold text-slate-700">Lessons:</span> {course.lessons}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Progress:</span> {course.progress}%
                </p>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: course.accent, width: `${course.progress}%` }}
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
              <img alt={previewCourse.title} className="h-48 w-full object-cover" src={previewCourse.imageUrl} />
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b2a57]">Simulation Preview</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{previewCourse.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {previewCourse.description} This module includes guided checkpoints, decision branches, and incident debrief scoring.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${getDifficultyClasses(previewCourse.difficulty)}`}>
                    {previewCourse.difficulty}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.lessons} Lessons
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                    {previewCourse.duration}
                  </span>
                </div>

                <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Course Lessons</p>
                  {previewCourse.lessonOutline.map((lesson) => (
                    <div key={lesson.title}>
                      <div className="mb-2 overflow-hidden rounded-lg border border-slate-200 bg-black">
                        <iframe
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="aspect-video w-full"
                          referrerPolicy="strict-origin-when-cross-origin"
                          src={lesson.videoUrl}
                          title={`${lesson.title} video`}
                        />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{lesson.title}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600 sm:text-sm">
                        {lesson.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                  <iframe
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="aspect-video w-full"
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={activeCourse.lessonOutline[activeLessonIndex].videoUrl}
                    title={`${activeCourse.lessonOutline[activeLessonIndex].title} training video`}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{activeCourse.lessonOutline[activeLessonIndex].title}</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                    {activeCourse.lessonOutline[activeLessonIndex].points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
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