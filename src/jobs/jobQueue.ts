import { Job, JobSchema, JobType } from "../domain";

export class JobQueue {
  private readonly jobs = new Map<string, Job>();

  enqueue(ownerId: string, type: JobType, payload: unknown, idempotencyKey: string): Job {
    const existing = [...this.jobs.values()].find((job) => job.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const job = JobSchema.parse({
      id: crypto.randomUUID(),
      ownerId,
      type,
      status: "PENDING",
      payload,
      createdAt: new Date().toISOString(),
      idempotencyKey
    });
    this.jobs.set(job.id, job);
    return job;
  }

  markCompleted(id: string): void {
    const job = this.jobs.get(id);
    if (!job) throw new Error("Job not found.");
    this.jobs.set(id, { ...job, status: "COMPLETED", completedAt: new Date().toISOString() });
  }

  cancelPendingPublishJobs(ownerId: string): number {
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (job.ownerId === ownerId && job.type === "PUBLISH_POST" && ["PENDING", "RETRYING"].includes(job.status)) {
        this.jobs.set(id, { ...job, status: "CANCELLED", completedAt: new Date().toISOString() });
        count += 1;
      }
    }
    return count;
  }

  list(): Job[] {
    return [...this.jobs.values()];
  }
}
