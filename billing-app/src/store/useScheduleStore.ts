import { create } from 'zustand';
import { ScheduledJob } from '@/types';

interface ScheduleStore {
  jobs: ScheduledJob[];
  setJobs: (jobs: ScheduledJob[]) => void;
  addJob: (job: ScheduledJob) => void;
  updateJob: (jobId: string, updates: Partial<ScheduledJob>) => void;
  getJobsByCustomer: (customerId: string) => ScheduledJob[];
  getUpcomingJobs: () => ScheduledJob[];
  getRecentRuns: () => ScheduledJob[];
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
  updateJob: (jobId, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === jobId ? { ...job, ...updates } : job
      ),
    })),
  getJobsByCustomer: (customerId) =>
    get().jobs.filter((job) => job.customerId === customerId),
  getUpcomingJobs: () =>
    get()
      .jobs.filter((job) => job.status === 'PENDING')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
  getRecentRuns: () =>
    get()
      .jobs.filter((job) => job.status !== 'PENDING')
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
}));
