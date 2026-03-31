export type SimulationCourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type SimulationLesson = {
  id: string
  title: string
  duration: string
  videoUrl: string
  videoFileName?: string
  summary: string
  points: string[]
}

export type LearningMaterialType = 'PDF' | 'Guide' | 'Checklist' | 'Worksheet' | 'External Link'

export type SimulationLearningMaterial = {
  id: string
  title: string
  type: LearningMaterialType
  url: string
  fileName?: string
  mimeType?: string
  description: string
}

export type SimulationCourse = {
  id: string
  title: string
  tag: string
  difficulty: SimulationCourseDifficulty
  duration: string
  description: string
  audience: string
  objectives: string[]
  prerequisites: string[]
  accent: string
  heroImageUrl: string
  heroImageName?: string
  lessonOutline: SimulationLesson[]
  learningMaterials: SimulationLearningMaterial[]
}

const SIMULATION_COURSES_KEY = 'drms-simulation-courses'
export const SIMULATION_COURSES_CHANGED_EVENT = 'drms-simulation-courses-changed'
export const SIMULATION_COURSE_STORAGE_ERROR =
  'Uploaded media is stored in your browser. This file is too large for browser storage, so save a smaller file or use an external link.'

function buildId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyLesson(): SimulationLesson {
  return {
    id: buildId('lesson'),
    title: 'New Lesson',
    duration: '10 min',
    videoUrl: '',
    videoFileName: '',
    summary: '',
    points: [''],
  }
}

export function createEmptyLearningMaterial(): SimulationLearningMaterial {
  return {
    id: buildId('material'),
    title: 'New Material',
    type: 'Guide',
    url: '',
    fileName: '',
    mimeType: '',
    description: '',
  }
}

export function createEmptySimulationCourse(): SimulationCourse {
  return {
    id: buildId('course'),
    title: 'New Course',
    tag: 'Preparedness Training',
    difficulty: 'Beginner',
    duration: '30 min',
    description: '',
    audience: '',
    objectives: [''],
    prerequisites: [''],
    accent: '#0b2a57',
    heroImageUrl: '',
    heroImageName: '',
    lessonOutline: [createEmptyLesson()],
    learningMaterials: [createEmptyLearningMaterial()],
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Could not read the selected file.'))
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

export function isEmbeddedVideoUrl(url: string): boolean {
  const normalizedUrl = url.trim().toLowerCase()
  return (
    normalizedUrl.includes('youtube.com/embed/') ||
    normalizedUrl.includes('youtube.com/watch') ||
    normalizedUrl.includes('youtu.be/') ||
    normalizedUrl.includes('player.vimeo.com/') ||
    normalizedUrl.includes('vimeo.com/')
  )
}

const defaultSimulationCourses: SimulationCourse[] = [
  {
    id: 'earthquake',
    title: 'Earthquake Response Course',
    tag: 'Seismic Training',
    difficulty: 'Beginner',
    duration: '35 min',
    description: 'Practice early warning response, safe shelter decisions, evacuation, and post-quake reporting drills.',
    audience: 'Citizens, households, barangay volunteers, and first-time preparedness learners.',
    objectives: [
      'Recognize earthquake warning signs and immediate response actions.',
      'Practice Drop, Cover, and Hold in realistic scenarios.',
      'Follow safe evacuation and post-quake reporting procedures.',
    ],
    prerequisites: ['Basic mobile or desktop internet access.', 'Willingness to complete all lesson videos before progressing.'],
    accent: '#f59e0b',
    heroImageUrl: 'https://images.unsplash.com/photo-1508182314998-3bd49473002f?auto=format&fit=crop&w=1000&q=80',
    heroImageName: 'earthquake-course-cover.jpg',
    lessonOutline: [
      {
        id: 'earthquake-lesson-1',
        title: 'Lesson 1 - Before an Earthquake',
        duration: '11 min',
        videoUrl: 'https://www.youtube.com/embed/BLEPakj1YTY',
        videoFileName: '',
        summary: 'Set up your emergency kit, identify safe zones, and review household communication plans.',
        points: [
          'Prepare an emergency kit with water, flashlight, radio, and first aid supplies.',
          'Identify sturdy furniture and safe zones in each room.',
          'Agree on a family communication and meet-up plan.',
        ],
      },
      {
        id: 'earthquake-lesson-2',
        title: 'Lesson 2 - During an Earthquake',
        duration: '12 min',
        videoUrl: 'https://www.youtube.com/embed/4WfA7xri9Kk',
        videoFileName: '',
        summary: 'Focus on safe protective actions while the shaking is ongoing.',
        points: ['Perform Drop, Cover, and Hold.', 'Stay away from windows, shelves, and unsecured furniture.'],
      },
      {
        id: 'earthquake-lesson-3',
        title: 'Lesson 3 - After an Earthquake',
        duration: '12 min',
        videoUrl: 'https://www.youtube.com/embed/Cz4N6A8x5q8',
        videoFileName: '',
        summary: 'Learn how to assess injuries, avoid hazards, and report incidents safely.',
        points: ['Check for injuries and damaged utilities.', 'Evacuate calmly and proceed to the evacuation area.'],
      },
    ],
    learningMaterials: [
      {
        id: 'earthquake-material-1',
        title: 'Household Earthquake Checklist',
        type: 'Checklist',
        url: 'https://www.ready.gov/earthquakes',
        fileName: '',
        mimeType: '',
        description: 'A printable checklist for home preparedness and emergency supplies.',
      },
      {
        id: 'earthquake-material-2',
        title: 'Evacuation Bag Guide',
        type: 'Guide',
        url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/earthquake.html',
        fileName: '',
        mimeType: '',
        description: 'Reference guide for items to include in a go-bag.',
      },
    ],
  },
  {
    id: 'fire',
    title: 'Fire Emergency Course',
    tag: 'Fire Suppression',
    difficulty: 'Intermediate',
    duration: '40 min',
    description: 'Run scenario-based evacuation paths, extinguisher choices, and coordination with fire response teams.',
    audience: 'Citizens, business owners, floor marshals, and community emergency response volunteers.',
    objectives: [
      'Identify common fire hazards at home and in workplaces.',
      'Choose the correct first response and evacuation action.',
      'Coordinate emergency reporting and responder handoff clearly.',
    ],
    prerequisites: ['Know the nearest building exit routes.', 'Complete the lessons in sequence before taking the final checkpoint.'],
    accent: '#ef4444',
    heroImageUrl: 'https://images.unsplash.com/photo-1578825922519-485b4dd5c533?auto=format&fit=crop&w=1000&q=80',
    heroImageName: 'fire-course-cover.jpg',
    lessonOutline: [
      {
        id: 'fire-lesson-1',
        title: 'Lesson 1 - Preventing Fire',
        duration: '12 min',
        videoUrl: 'https://www.youtube.com/embed/woLrY8J6f4g',
        videoFileName: '',
        summary: 'Reduce fire risk through regular inspections and safe appliance practices.',
        points: ['Check wiring and appliances regularly.', 'Do not leave cooking unattended.'],
      },
      {
        id: 'fire-lesson-2',
        title: 'Lesson 2 - During a Fire',
        duration: '14 min',
        videoUrl: 'https://www.youtube.com/embed/7nL10C7FSbE',
        videoFileName: '',
        summary: 'Make safe evacuation decisions while avoiding smoke exposure.',
        points: ['Evacuate immediately using the nearest exit.', 'Crawl low when smoke is thick.'],
      },
      {
        id: 'fire-lesson-3',
        title: 'Lesson 3 - Call for Help',
        duration: '14 min',
        videoUrl: 'https://www.youtube.com/embed/gxAA3gS8qzY',
        videoFileName: '',
        summary: 'Report fire incidents clearly and support responder coordination.',
        points: ['Call the fire department.', 'Provide the exact location of the fire and trapped occupants if any.'],
      },
    ],
    learningMaterials: [
      {
        id: 'fire-material-1',
        title: 'Fire Exit Drill Worksheet',
        type: 'Worksheet',
        url: 'https://www.ready.gov/home-fires',
        fileName: '',
        mimeType: '',
        description: 'Worksheet for mapping exits and family meeting points.',
      },
      {
        id: 'fire-material-2',
        title: 'Extinguisher Use Reference',
        type: 'PDF',
        url: 'https://www.osha.gov/sites/default/files/publications/OSHA3695.pdf',
        fileName: '',
        mimeType: '',
        description: 'Basic PASS method refresher for extinguisher use.',
      },
    ],
  },
  {
    id: 'accidents',
    title: 'Road Accident Course',
    tag: 'Traffic Triage',
    difficulty: 'Advanced',
    duration: '30 min',
    description: 'Train incident scene control, first-response triage basics, and rapid escalation procedures.',
    audience: 'Drivers, community responders, and volunteers supporting traffic incident response.',
    objectives: [
      'Secure the scene before attempting any assistance.',
      'Apply basic triage and emergency reporting steps.',
      'Document and relay incident details to responders accurately.',
    ],
    prerequisites: ['Do not attempt rescue beyond your training level.', 'Prioritize your own safety before helping others.'],
    accent: '#0ea5e9',
    heroImageUrl: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1000&q=80',
    heroImageName: 'road-accident-course-cover.jpg',
    lessonOutline: [
      {
        id: 'accidents-lesson-1',
        title: 'Lesson 1 - Stay Safe',
        duration: '10 min',
        videoUrl: 'https://www.youtube.com/embed/qxVYg6R3x9I',
        videoFileName: '',
        summary: 'Establish a safe perimeter and avoid creating more casualties.',
        points: ['Move away from traffic immediately.', 'Turn on hazard lights if you are the driver.'],
      },
      {
        id: 'accidents-lesson-2',
        title: 'Lesson 2 - Help the Injured',
        duration: '10 min',
        videoUrl: 'https://www.youtube.com/embed/5V2Vx4HjK8s',
        videoFileName: '',
        summary: 'Perform only safe, basic first-response support while waiting for professionals.',
        points: ['Check if the victim is conscious.', 'Control bleeding if it is safe and possible.'],
      },
      {
        id: 'accidents-lesson-3',
        title: 'Lesson 3 - Report the Incident',
        duration: '10 min',
        videoUrl: 'https://www.youtube.com/embed/9j7M6vN2wL0',
        videoFileName: '',
        summary: 'Communicate accurate location and casualty details to emergency responders.',
        points: ['Call an ambulance or police.', 'Report clear details of the incident location.'],
      },
    ],
    learningMaterials: [
      {
        id: 'accidents-material-1',
        title: 'Roadside Incident Checklist',
        type: 'Checklist',
        url: 'https://www.cdc.gov/motorvehiclesafety/index.html',
        fileName: '',
        mimeType: '',
        description: 'Quick checklist for citizen responders at road incidents.',
      },
      {
        id: 'accidents-material-2',
        title: 'First Response Guide',
        type: 'Guide',
        url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid',
        fileName: '',
        mimeType: '',
        description: 'Basic first aid reference for non-professional responders.',
      },
    ],
  },
]

function cloneCourses(courses: SimulationCourse[]): SimulationCourse[] {
  return courses.map((course) => ({
    ...course,
    heroImageName: course.heroImageName ?? '',
    objectives: [...course.objectives],
    prerequisites: [...course.prerequisites],
    lessonOutline: course.lessonOutline.map((lesson) => ({
      ...lesson,
      videoFileName: lesson.videoFileName ?? '',
      points: [...lesson.points],
    })),
    learningMaterials: course.learningMaterials.map((material) => ({
      ...material,
      fileName: material.fileName ?? '',
      mimeType: material.mimeType ?? '',
    })),
  }))
}

function isDifficulty(value: unknown): value is SimulationCourseDifficulty {
  return value === 'Beginner' || value === 'Intermediate' || value === 'Advanced'
}

function isMaterialType(value: unknown): value is LearningMaterialType {
  return value === 'PDF' || value === 'Guide' || value === 'Checklist' || value === 'Worksheet' || value === 'External Link'
}

function hasLegacyStoredMetrics(input: unknown): boolean {
  if (!Array.isArray(input)) {
    return false
  }

  return input.some(
    (item) =>
      Boolean(item) &&
      typeof item === 'object' &&
      ('trainees' in item || 'completionRate' in item),
  )
}

function normalizeCourses(input: unknown): SimulationCourse[] | null {
  if (!Array.isArray(input)) {
    return null
  }

  const normalized = input
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const lessons = Array.isArray(item.lessonOutline)
        ? item.lessonOutline
            .filter((lesson): lesson is Record<string, unknown> => Boolean(lesson) && typeof lesson === 'object')
            .map((lesson, index) => ({
              id: typeof lesson.id === 'string' && lesson.id ? lesson.id : buildId(`lesson-${index + 1}`),
              title: typeof lesson.title === 'string' ? lesson.title : `Lesson ${index + 1}`,
              duration: typeof lesson.duration === 'string' ? lesson.duration : '10 min',
              videoUrl: typeof lesson.videoUrl === 'string' ? lesson.videoUrl : '',
              videoFileName: typeof lesson.videoFileName === 'string' ? lesson.videoFileName : '',
              summary: typeof lesson.summary === 'string' ? lesson.summary : '',
              points: Array.isArray(lesson.points)
                ? lesson.points.filter((point): point is string => typeof point === 'string')
                : [],
            }))
        : []

      const learningMaterials = Array.isArray(item.learningMaterials)
        ? item.learningMaterials
            .filter((material): material is Record<string, unknown> => Boolean(material) && typeof material === 'object')
            .map((material, index) => ({
              id: typeof material.id === 'string' && material.id ? material.id : buildId(`material-${index + 1}`),
              title: typeof material.title === 'string' ? material.title : `Material ${index + 1}`,
              type: isMaterialType(material.type) ? material.type : 'Guide',
              url: typeof material.url === 'string' ? material.url : '',
              fileName: typeof material.fileName === 'string' ? material.fileName : '',
              mimeType: typeof material.mimeType === 'string' ? material.mimeType : '',
              description: typeof material.description === 'string' ? material.description : '',
            }))
        : []

      return {
        id: typeof item.id === 'string' && item.id ? item.id : buildId('course'),
        title: typeof item.title === 'string' ? item.title : 'Untitled Course',
        tag: typeof item.tag === 'string' ? item.tag : 'Preparedness Training',
        difficulty: isDifficulty(item.difficulty) ? item.difficulty : 'Beginner',
        duration: typeof item.duration === 'string' ? item.duration : '30 min',
        description: typeof item.description === 'string' ? item.description : '',
        audience: typeof item.audience === 'string' ? item.audience : '',
        objectives: Array.isArray(item.objectives)
          ? item.objectives.filter((objective): objective is string => typeof objective === 'string')
          : [],
        prerequisites: Array.isArray(item.prerequisites)
          ? item.prerequisites.filter((entry): entry is string => typeof entry === 'string')
          : [],
        accent: typeof item.accent === 'string' && item.accent ? item.accent : '#0b2a57',
        heroImageUrl: typeof item.heroImageUrl === 'string' ? item.heroImageUrl : '',
        heroImageName: typeof item.heroImageName === 'string' ? item.heroImageName : '',
        lessonOutline: lessons.length > 0 ? lessons : [createEmptyLesson()],
        learningMaterials,
      }
    })

  return normalized.length > 0 ? normalized : null
}

function emitCoursesChanged(): void {
  window.dispatchEvent(new Event(SIMULATION_COURSES_CHANGED_EVENT))
}

export function getSimulationCourses(): SimulationCourse[] {
  try {
    const raw = localStorage.getItem(SIMULATION_COURSES_KEY)
    if (!raw) {
      return cloneCourses(defaultSimulationCourses)
    }

    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeCourses(parsed)
    if (!normalized) {
      return cloneCourses(defaultSimulationCourses)
    }

    if (hasLegacyStoredMetrics(parsed)) {
      localStorage.setItem(SIMULATION_COURSES_KEY, JSON.stringify(normalized))
    }

    return cloneCourses(normalized)
  } catch {
    return cloneCourses(defaultSimulationCourses)
  }
}

export function saveSimulationCourses(courses: SimulationCourse[]): void {
  try {
    localStorage.setItem(SIMULATION_COURSES_KEY, JSON.stringify(courses))
    emitCoursesChanged()
  } catch {
    throw new Error(SIMULATION_COURSE_STORAGE_ERROR)
  }
}
