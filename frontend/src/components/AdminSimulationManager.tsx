import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { getSimulationAdminMetrics } from '../services/api'
import {
  SIMULATION_COURSES_CHANGED_EVENT,
  createEmptyLearningMaterial,
  createEmptyLesson,
  createEmptySimulationCourse,
  getSimulationCourses,
  readFileAsDataUrl,
  saveSimulationCourses,
  type LearningMaterialType,
  type SimulationCourse,
  type SimulationCourseDifficulty,
} from '../services/simulationCourses'
import type { SimulationAdminCourseMetrics } from '../types/api'

type EditableCourse = SimulationCourse | null
type FeedbackTone = 'success' | 'error'
type CourseWithMetrics = SimulationCourse & SimulationAdminCourseMetrics
type AdminSimulationManagerProps = {
  embedded?: boolean
}

const difficultyOptions: SimulationCourseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const materialTypeOptions: LearningMaterialType[] = ['PDF', 'Guide', 'Checklist', 'Worksheet', 'External Link']

function getMaterialTypeFromFile(file: File): LearningMaterialType {
  if (file.type === 'application/pdf') {
    return 'PDF'
  }

  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  if (fileExtension === 'pdf') {
    return 'PDF'
  }

  if (['doc', 'docx', 'txt', 'md'].includes(fileExtension ?? '')) {
    return 'Guide'
  }

  if (['xls', 'xlsx', 'csv'].includes(fileExtension ?? '')) {
    return 'Worksheet'
  }

  return 'External Link'
}

export function AdminSimulationManager({ embedded = false }: AdminSimulationManagerProps) {
  const [courses, setCourses] = useState<SimulationCourse[]>(() => getSimulationCourses())
  const [courseMetrics, setCourseMetrics] = useState<Record<string, SimulationAdminCourseMetrics>>({})
  const [editingCourse, setEditingCourse] = useState<EditableCourse>(null)
  const [draftCourse, setDraftCourse] = useState<EditableCourse>(null)
  const [isCreatingCourse, setIsCreatingCourse] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('success')

  const coursesWithMetrics = useMemo(
    () =>
      courses.map((course) => ({
        ...course,
        trainees: courseMetrics[course.id]?.trainees ?? 0,
        completionRate: courseMetrics[course.id]?.completionRate ?? 0,
      }) satisfies CourseWithMetrics),
    [courseMetrics, courses],
  )

  useEffect(() => {
    setDraftCourse(editingCourse ? JSON.parse(JSON.stringify(editingCourse)) : null)
  }, [editingCourse])

  useEffect(() => {
    let isActive = true

    async function loadCourseMetrics(): Promise<void> {
      try {
        const response = await getSimulationAdminMetrics()
        if (!isActive) {
          return
        }

        setCourseMetrics(response.courses ?? {})
      } catch {
        if (isActive) {
          setCourseMetrics({})
        }
      }
    }

    void loadCourseMetrics()
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    function syncCourses(): void {
      setCourses(getSimulationCourses())
    }

    window.addEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
    return () => window.removeEventListener(SIMULATION_COURSES_CHANGED_EVENT, syncCourses)
  }, [])

  const totalLessons = useMemo(() => courses.reduce((total, course) => total + course.lessonOutline.length, 0), [courses])
  const totalMaterials = useMemo(() => courses.reduce((total, course) => total + course.learningMaterials.length, 0), [courses])
  const containerClass = embedded ? 'flex flex-col gap-6' : 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-10'
  const sectionClass = embedded
    ? 'rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
    : 'rounded-3xl border border-slate-700 bg-[#232837] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.25)]'
  const mutedTextClass = embedded ? 'text-slate-700' : 'text-slate-400'
  const bodyTextClass = embedded ? 'text-slate-800' : 'text-slate-300'
  const headingTextClass = embedded ? 'text-slate-900' : 'text-white'
  const subPanelClass = embedded ? 'rounded-2xl border border-slate-300 bg-slate-50' : 'rounded-2xl border border-slate-700 bg-[#1d2230]'
  const cardClass = embedded ? 'rounded-3xl border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]' : 'rounded-3xl border border-slate-700 bg-[#232837] p-5'
  const nestedCardClass = embedded ? 'rounded-2xl border border-slate-300 bg-white p-4' : 'rounded-2xl border border-slate-700 bg-[#232837] p-4'
  const inputClass = embedded
    ? 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
    : 'w-full rounded-xl border border-slate-600 bg-[#1d2230] px-3 py-2 text-sm text-white outline-none'
  const textareaClass = embedded
    ? 'min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
    : 'min-h-24 w-full rounded-xl border border-slate-600 bg-[#1d2230] px-3 py-2 text-sm text-white outline-none'
  const largeTextareaClass = embedded
    ? 'min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-700'
    : 'min-h-28 w-full rounded-xl border border-slate-600 bg-[#1d2230] px-3 py-2 text-sm text-white outline-none'
  const primaryButtonClass = embedded
    ? 'rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800'
    : 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500'
  const secondaryButtonClass = embedded
    ? 'rounded-xl border border-blue-700 bg-white px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50'
    : 'rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-400'
  const tertiaryButtonClass = embedded
    ? 'rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100'
    : 'rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-400'
  const ghostButtonClass = embedded
    ? 'rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition hover:bg-blue-100'
    : 'rounded-xl border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-400'
  const dangerButtonClass = embedded
    ? 'rounded-xl border border-red-700 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.18)] transition hover:border-red-800 hover:bg-red-800'
    : 'rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(220,38,38,0.2)] transition hover:border-red-500 hover:bg-red-500'
  const fileInputClass = embedded
    ? 'block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-800'
    : 'block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-500'
  const infoBannerClass = embedded
    ? 'mt-5 rounded-2xl border border-blue-300 bg-blue-100 px-4 py-3 text-sm font-medium text-blue-900'
    : 'mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100'
  const feedbackSuccessClass = embedded
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
  const feedbackErrorClass = embedded
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-red-500/30 bg-red-500/10 text-red-100'
  const modalOverlayClass = embedded ? 'fixed inset-0 z-[1400] bg-slate-900/25 p-4 sm:p-8' : 'fixed inset-0 z-[1400] bg-slate-950/60 p-4 backdrop-blur-[2px] sm:p-8'

  function getTraineeCountLabel(count: number): string {
    return count.toLocaleString()
  }

  function getCourseMetrics(courseId: string | undefined): SimulationAdminCourseMetrics {
    if (!courseId) {
      return {
        trainees: 0,
        completed: 0,
        completionRate: 0,
      }
    }

    return (
      courseMetrics[courseId] ?? {
        trainees: 0,
        completed: 0,
        completionRate: 0,
      }
    )
  }

  function showFeedback(message: string, tone: FeedbackTone): void {
    setFeedbackMessage(message)
    setFeedbackTone(tone)
  }

  function clearFeedback(): void {
    setFeedbackMessage('')
    setFeedbackTone('success')
  }

  function openEditor(course: SimulationCourse): void {
    setIsCreatingCourse(false)
    setEditingCourse(course)
    clearFeedback()
  }

  function openCreateCourse(): void {
    setIsCreatingCourse(true)
    setEditingCourse(createEmptySimulationCourse())
    clearFeedback()
  }

  function closeEditor(): void {
    setEditingCourse(null)
    setDraftCourse(null)
    setIsCreatingCourse(false)
  }

  function updateDraftCourse(updater: (current: SimulationCourse) => SimulationCourse): void {
    setDraftCourse((current) => (current ? updater(current) : current))
  }

  function updateDraftField(field: keyof SimulationCourse, value: string | number): void {
    updateDraftCourse((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateDraftList(field: 'objectives' | 'prerequisites', value: string): void {
    updateDraftCourse((current) => ({
      ...current,
      [field]: value
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
    }))
  }

  function updateLessonField(index: number, field: 'title' | 'duration' | 'videoUrl' | 'summary' | 'videoFileName', value: string): void {
    updateDraftCourse((current) => ({
      ...current,
      lessonOutline: current.lessonOutline.map((lesson, lessonIndex) =>
        lessonIndex === index
          ? {
              ...lesson,
              [field]: value,
            }
          : lesson,
      ),
    }))
  }

  function updateLessonPoints(index: number, value: string): void {
    updateDraftCourse((current) => ({
      ...current,
      lessonOutline: current.lessonOutline.map((lesson, lessonIndex) =>
        lessonIndex === index
          ? {
              ...lesson,
              points: value
                .split('\n')
                .map((point) => point.trim())
                .filter(Boolean),
            }
          : lesson,
      ),
    }))
  }

  async function handleHeroImageUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(selectedFile)
      updateDraftCourse((current) => ({
        ...current,
        heroImageUrl: imageDataUrl,
        heroImageName: selectedFile.name,
      }))
      clearFeedback()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Unable to load the selected image.', 'error')
    } finally {
      event.target.value = ''
    }
  }

  function clearHeroImage(): void {
    updateDraftCourse((current) => ({
      ...current,
      heroImageUrl: '',
      heroImageName: '',
    }))
  }

  async function handleLessonVideoUpload(index: number, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    try {
      const videoDataUrl = await readFileAsDataUrl(selectedFile)
      updateDraftCourse((current) => ({
        ...current,
        lessonOutline: current.lessonOutline.map((lesson, lessonIndex) =>
          lessonIndex === index
            ? {
                ...lesson,
                videoUrl: videoDataUrl,
                videoFileName: selectedFile.name,
              }
            : lesson,
        ),
      }))
      clearFeedback()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Unable to load the selected video.', 'error')
    } finally {
      event.target.value = ''
    }
  }

  function clearLessonVideo(index: number): void {
    updateDraftCourse((current) => ({
      ...current,
      lessonOutline: current.lessonOutline.map((lesson, lessonIndex) =>
        lessonIndex === index
          ? {
              ...lesson,
              videoUrl: '',
              videoFileName: '',
            }
          : lesson,
      ),
    }))
  }

  function addLesson(): void {
    updateDraftCourse((current) => ({
      ...current,
      lessonOutline: [...current.lessonOutline, createEmptyLesson()],
    }))
  }

  function removeLesson(index: number): void {
    updateDraftCourse((current) => {
      if (current.lessonOutline.length <= 1) {
        return current
      }

      return {
        ...current,
        lessonOutline: current.lessonOutline.filter((_, lessonIndex) => lessonIndex !== index),
      }
    })
  }

  function updateMaterialField(
    index: number,
    field: 'title' | 'type' | 'url' | 'description' | 'fileName' | 'mimeType',
    value: string,
  ): void {
    updateDraftCourse((current) => ({
      ...current,
      learningMaterials: current.learningMaterials.map((material, materialIndex) =>
        materialIndex === index
          ? {
              ...material,
              [field]: value,
            }
          : material,
      ),
    }))
  }

  async function handleMaterialFileUpload(index: number, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    try {
      const fileDataUrl = await readFileAsDataUrl(selectedFile)
      updateDraftCourse((current) => ({
        ...current,
        learningMaterials: current.learningMaterials.map((material, materialIndex) =>
          materialIndex === index
            ? {
                ...material,
                url: fileDataUrl,
                fileName: selectedFile.name,
                mimeType: selectedFile.type,
                type: material.type === 'External Link' ? getMaterialTypeFromFile(selectedFile) : material.type,
              }
            : material,
        ),
      }))
      clearFeedback()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Unable to load the selected material.', 'error')
    } finally {
      event.target.value = ''
    }
  }

  function clearMaterialAsset(index: number): void {
    updateDraftCourse((current) => ({
      ...current,
      learningMaterials: current.learningMaterials.map((material, materialIndex) =>
        materialIndex === index
          ? {
              ...material,
              url: '',
              fileName: '',
              mimeType: '',
            }
          : material,
      ),
    }))
  }

  function addLearningMaterial(): void {
    updateDraftCourse((current) => ({
      ...current,
      learningMaterials: [...current.learningMaterials, createEmptyLearningMaterial()],
    }))
  }

  function removeLearningMaterial(index: number): void {
    updateDraftCourse((current) => ({
      ...current,
      learningMaterials: current.learningMaterials.filter((_, materialIndex) => materialIndex !== index),
    }))
  }

  function deleteCourse(courseId: string): void {
    const nextCourses = courses.filter((course) => course.id !== courseId)

    try {
      saveSimulationCourses(nextCourses)
      setCourses(nextCourses)
      showFeedback('Course deleted successfully.', 'success')
      if (editingCourse?.id === courseId) {
        closeEditor()
      }
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Unable to delete the course right now.', 'error')
    }
  }

  function saveCourse(): void {
    if (!draftCourse) {
      return
    }

    const sanitizedCourse: SimulationCourse = {
      ...draftCourse,
      title: draftCourse.title.trim() || 'Untitled Course',
      tag: draftCourse.tag.trim() || 'Preparedness Training',
      duration: draftCourse.duration.trim() || '30 min',
      description: draftCourse.description.trim(),
      audience: draftCourse.audience.trim(),
      heroImageUrl: draftCourse.heroImageUrl.trim(),
      heroImageName: draftCourse.heroImageName?.trim() || '',
      objectives: draftCourse.objectives.filter(Boolean),
      prerequisites: draftCourse.prerequisites.filter(Boolean),
      lessonOutline: draftCourse.lessonOutline.map((lesson, index) => ({
        ...lesson,
        title: lesson.title.trim() || `Lesson ${index + 1}`,
        duration: lesson.duration.trim() || '10 min',
        videoUrl: lesson.videoUrl.trim(),
        videoFileName: lesson.videoFileName?.trim() || '',
        summary: lesson.summary.trim(),
        points: lesson.points.filter(Boolean),
      })),
      learningMaterials: draftCourse.learningMaterials
        .map((material) => ({
          ...material,
          title: material.title.trim(),
          url: material.url.trim(),
          fileName: material.fileName?.trim() || '',
          mimeType: material.mimeType?.trim() || '',
          description: material.description.trim(),
        }))
        .filter((material) => material.title || material.url || material.description || material.fileName),
    }

    const nextCourses = isCreatingCourse
      ? [sanitizedCourse, ...courses]
      : courses.map((course) => (course.id === sanitizedCourse.id ? sanitizedCourse : course))

    try {
      saveSimulationCourses(nextCourses)
      setCourses(nextCourses)
      showFeedback(isCreatingCourse ? 'Course created successfully.' : 'Course changes saved successfully.', 'success')
      closeEditor()
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Unable to save the course right now.', 'error')
    }
  }

  return (
    <>
      <div className={containerClass}>
        <section className={sectionClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${mutedTextClass}`}>Simulation Editor</p>
              <p className={`mt-2 max-w-3xl text-sm leading-relaxed ${bodyTextClass}`}>
                Add and manage the full citizen-facing simulation course content, including title, audience, objectives, lessons,
                uploaded videos, hero images, and downloadable learning materials.
              </p>
            </div>
            <button
              className={primaryButtonClass}
              onClick={openCreateCourse}
              type="button"
            >
              Add Course
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <article className={`${subPanelClass} px-4 py-3`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>Courses</p>
              <p className={`mt-2 text-2xl font-black ${headingTextClass}`}>{courses.length}</p>
            </article>
            <article className={`${subPanelClass} px-4 py-3`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>Lessons</p>
              <p className={`mt-2 text-2xl font-black ${headingTextClass}`}>{totalLessons}</p>
            </article>
            <article className={`${subPanelClass} px-4 py-3`}>
              <p className={`text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>Learning Materials</p>
              <p className={`mt-2 text-2xl font-black ${headingTextClass}`}>{totalMaterials}</p>
            </article>
          </div>

          <div className={infoBannerClass}>
            Uploaded images, videos, and files are stored in this browser. For large videos, use a smaller file or an external video URL.
          </div>

          {feedbackMessage ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                feedbackTone === 'success'
                  ? feedbackSuccessClass
                  : feedbackErrorClass
              }`}
            >
              {feedbackMessage}
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {coursesWithMetrics.map((course) => (
            <article className={cardClass} key={course.id}>
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${embedded ? 'border-blue-300 bg-blue-100 text-blue-900' : 'border-slate-600 bg-[#1d2230] text-slate-300'}`}>
                  {course.tag}
                </span>
                <span className={`text-xs ${mutedTextClass}`}>{course.duration}</span>
              </div>

              <h2 className={`mt-4 text-xl font-bold ${headingTextClass}`}>{course.title}</h2>
              <p className={`mt-2 text-sm leading-relaxed ${bodyTextClass}`}>{course.description || 'No course description yet.'}</p>

              <div className={`mt-4 flex flex-wrap gap-2 text-[11px] ${embedded ? 'text-blue-900' : 'text-slate-300'}`}>
                <span className={`rounded-full border px-3 py-1 ${embedded ? 'border-blue-300 bg-blue-100' : 'border-slate-600 bg-[#1d2230]'}`}>{course.difficulty}</span>
                <span className={`rounded-full border px-3 py-1 ${embedded ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-slate-600 bg-[#1d2230]'}`}>{course.lessonOutline.length} lessons</span>
                <span className={`rounded-full border px-3 py-1 ${embedded ? 'border-emerald-300 bg-emerald-100 text-emerald-900' : 'border-slate-600 bg-[#1d2230]'}`}>{course.learningMaterials.length} materials</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className={`${subPanelClass} px-3 py-2`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>Trainees</p>
                  <p className={`mt-1 font-semibold ${headingTextClass}`}>{getTraineeCountLabel(course.trainees)}</p>
                  <p className={`mt-1 text-[11px] ${mutedTextClass}`}>Automatically counted from learner activity</p>
                </div>
                <div className={`${subPanelClass} px-3 py-2`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>Completion</p>
                  <p className={`mt-1 font-semibold ${embedded ? 'text-emerald-700' : 'text-emerald-300'}`}>{course.completionRate}%</p>
                  <p className={`mt-1 text-[11px] ${mutedTextClass}`}>Computed from completed trainees</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  className={primaryButtonClass}
                  onClick={() => openEditor(course)}
                  type="button"
                >
                  Edit Course
                </button>
                <button
                  className={dangerButtonClass}
                  onClick={() => deleteCourse(course.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {editingCourse && draftCourse ? (
        <div className={modalOverlayClass} onClick={closeEditor}>
          <div className="mx-auto mt-4 w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <section className={sectionClass}>
              <div className={`flex items-center justify-between gap-3 border-b ${embedded ? 'border-slate-200' : 'border-slate-700'} pb-4`}>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${mutedTextClass}`}>Course Editor</p>
                  <h3 className={`mt-1 text-2xl font-black ${headingTextClass}`}>{isCreatingCourse ? 'Create Simulation Course' : editingCourse.title}</h3>
                </div>
                <button
                  className={tertiaryButtonClass}
                  onClick={closeEditor}
                  type="button"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 max-h-[75vh] space-y-6 overflow-y-auto pr-1">
                <section className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Course Title</span>
                    <input className={inputClass} onChange={(event) => updateDraftField('title', event.target.value)} type="text" value={draftCourse.title} />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Tag</span>
                    <input className={inputClass} onChange={(event) => updateDraftField('tag', event.target.value)} type="text" value={draftCourse.tag} />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Difficulty</span>
                    <select className={inputClass} onChange={(event) => updateDraftField('difficulty', event.target.value)} value={draftCourse.difficulty}>
                      {difficultyOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Duration</span>
                    <input className={inputClass} onChange={(event) => updateDraftField('duration', event.target.value)} type="text" value={draftCourse.duration} />
                  </label>
                  <label className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Accent Color</span>
                    <div className="flex gap-2">
                      <input className={`h-11 w-14 rounded-xl px-1 py-1 ${embedded ? 'border border-slate-300 bg-white' : 'border border-slate-600 bg-[#1d2230]'}`} onChange={(event) => updateDraftField('accent', event.target.value)} type="color" value={draftCourse.accent} />
                      <input className={inputClass} onChange={(event) => updateDraftField('accent', event.target.value)} type="text" value={draftCourse.accent} />
                    </div>
                  </label>
                  <div className="block sm:col-span-2">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Hero Image</span>
                    <div className={`${subPanelClass} p-4`}>
                      {draftCourse.heroImageUrl ? (
                        <img alt={draftCourse.title} className="mb-3 h-40 w-full rounded-xl object-cover" src={draftCourse.heroImageUrl} />
                      ) : (
                        <div className={`mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed ${embedded ? 'border-slate-300 text-slate-500' : 'border-slate-600 text-slate-400'} text-sm`}>
                          No hero image uploaded yet.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <input accept="image/*" className={fileInputClass} onChange={handleHeroImageUpload} type="file" />
                        <input className={inputClass} onChange={(event) => updateDraftField('heroImageUrl', event.target.value)} placeholder="Or paste image URL" type="url" value={draftCourse.heroImageUrl} />
                        {draftCourse.heroImageName ? <p className={`w-full text-xs ${mutedTextClass}`}>Stored file: {draftCourse.heroImageName}</p> : null}
                        <button className={tertiaryButtonClass} onClick={clearHeroImage} type="button">
                          Clear Hero Image
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Trainees</span>
                    <div className={`${subPanelClass} flex min-h-11 items-center justify-between px-3 py-2 text-sm`}>
                      <span className={headingTextClass}>{getTraineeCountLabel(getCourseMetrics(draftCourse.id).trainees)}</span>
                      <span className={mutedTextClass}>Auto-counted</span>
                    </div>
                  </div>
                  <div className="block">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Completion Rate</span>
                    <div className={`${subPanelClass} flex min-h-11 items-center justify-between px-3 py-2 text-sm`}>
                      <span className={headingTextClass}>{getCourseMetrics(draftCourse.id).completionRate}%</span>
                      <span className={mutedTextClass}>Auto-computed</span>
                    </div>
                  </div>
                  <label className="block sm:col-span-2">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Description</span>
                    <textarea className={largeTextareaClass} onChange={(event) => updateDraftField('description', event.target.value)} value={draftCourse.description} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Audience</span>
                    <textarea className={textareaClass} onChange={(event) => updateDraftField('audience', event.target.value)} value={draftCourse.audience} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Objectives</span>
                    <textarea className={largeTextareaClass} onChange={(event) => updateDraftList('objectives', event.target.value)} placeholder="One objective per line" value={draftCourse.objectives.join('\n')} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Prerequisites</span>
                    <textarea className={textareaClass} onChange={(event) => updateDraftList('prerequisites', event.target.value)} placeholder="One prerequisite per line" value={draftCourse.prerequisites.join('\n')} />
                  </label>
                </section>

                <section className={`${subPanelClass} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${mutedTextClass}`}>Lessons and Videos</p>
                      <p className={`mt-1 text-sm ${bodyTextClass}`}>Each lesson can have its own title, summary, key points, embed URL, or uploaded video file.</p>
                    </div>
                    <button className={ghostButtonClass} onClick={addLesson} type="button">
                      Add Lesson
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {draftCourse.lessonOutline.map((lesson, index) => (
                      <article className={nestedCardClass} key={lesson.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm font-semibold ${headingTextClass}`}>Lesson {index + 1}</p>
                          <button className={`text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${embedded ? 'text-red-700 hover:text-red-800' : 'text-red-200 hover:text-red-100'}`} disabled={draftCourse.lessonOutline.length <= 1} onClick={() => removeLesson(index)} type="button">
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Lesson Title</span>
                            <input className={inputClass} onChange={(event) => updateLessonField(index, 'title', event.target.value)} type="text" value={lesson.title} />
                          </label>
                          <label className="block">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Lesson Duration</span>
                            <input className={inputClass} onChange={(event) => updateLessonField(index, 'duration', event.target.value)} type="text" value={lesson.duration} />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Video URL / Embed URL</span>
                            <input className={inputClass} onChange={(event) => updateLessonField(index, 'videoUrl', event.target.value)} type="url" value={lesson.videoUrl} />
                          </label>
                          <div className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Upload Video File</span>
                            <div className={`${subPanelClass} p-4`}>
                              <input accept="video/*" className={fileInputClass} onChange={(event) => void handleLessonVideoUpload(index, event)} type="file" />
                              {lesson.videoFileName ? <p className={`mt-2 text-xs ${mutedTextClass}`}>Stored video: {lesson.videoFileName}</p> : null}
                              <button className={`mt-3 ${tertiaryButtonClass}`} onClick={() => clearLessonVideo(index)} type="button">
                                Clear Video
                              </button>
                            </div>
                          </div>
                          <label className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Lesson Summary</span>
                            <textarea className={textareaClass} onChange={(event) => updateLessonField(index, 'summary', event.target.value)} value={lesson.summary} />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Key Points</span>
                            <textarea className={largeTextareaClass} onChange={(event) => updateLessonPoints(index, event.target.value)} placeholder="One point per line" value={lesson.points.join('\n')} />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={`${subPanelClass} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${mutedTextClass}`}>Learning Materials</p>
                      <p className={`mt-1 text-sm ${bodyTextClass}`}>Add URLs or upload files such as PDFs, worksheets, guides, and checklists shown on the citizen side.</p>
                    </div>
                    <button className={ghostButtonClass} onClick={addLearningMaterial} type="button">
                      Add Material
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {draftCourse.learningMaterials.map((material, index) => (
                      <article className={nestedCardClass} key={material.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm font-semibold ${headingTextClass}`}>Material {index + 1}</p>
                          <button className={`text-xs font-semibold transition ${embedded ? 'text-red-700 hover:text-red-800' : 'text-red-200 hover:text-red-100'}`} onClick={() => removeLearningMaterial(index)} type="button">
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Material Title</span>
                            <input className={inputClass} onChange={(event) => updateMaterialField(index, 'title', event.target.value)} type="text" value={material.title} />
                          </label>
                          <label className="block">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Material Type</span>
                            <select className={inputClass} onChange={(event) => updateMaterialField(index, 'type', event.target.value)} value={material.type}>
                              {materialTypeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Material URL</span>
                            <input className={inputClass} onChange={(event) => updateMaterialField(index, 'url', event.target.value)} type="url" value={material.url} />
                          </label>
                          <div className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Upload Material File</span>
                            <div className={`${subPanelClass} p-4`}>
                              <input accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,image/*,audio/*,video/*" className={fileInputClass} onChange={(event) => void handleMaterialFileUpload(index, event)} type="file" />
                              {material.fileName ? <p className={`mt-2 text-xs ${mutedTextClass}`}>Stored file: {material.fileName}</p> : null}
                              <button className={`mt-3 ${tertiaryButtonClass}`} onClick={() => clearMaterialAsset(index)} type="button">
                                Clear Material File
                              </button>
                            </div>
                          </div>
                          <label className="block sm:col-span-2">
                            <span className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>Description</span>
                            <textarea className={textareaClass} onChange={(event) => updateMaterialField(index, 'description', event.target.value)} value={material.description} />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button className={secondaryButtonClass} onClick={closeEditor} type="button">
                  Cancel
                </button>
                <button className={primaryButtonClass} onClick={saveCourse} type="button">
                  {isCreatingCourse ? 'Create Course' : 'Save Changes'}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}