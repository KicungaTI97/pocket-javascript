 // Importa funções para construir consultas SQL usando drizzle-orm
import { and, count, eq, gte, lte, sql } from "drizzle-orm"
import { db } from "../db"
import { goalCompletions, goals } from "../db/schema"
// Importa a biblioteca dayjs para manipulação de datas
import dayjs from "dayjs"

export async function getWeekSummary(){
    // Calcula o primeiro e o ultimo dia da semana actual
    const firstDayOfWeek = dayjs().startOf('week').toDate()
    const lastDayOfWeek = dayjs().endOf('week').toDate()

    // Cria uma Common Table Expression (CTE) para filtrar as metas criadas até o final da semana
    const goalsCreatedUpToWeek = db.$with('goals_created_up_week').as(
        db.select({
            id: goals.id,
            title: goals.title,
            desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
            createdAt: goals.createdAt,
        })
         .from(goals)
         .where(lte(goals.createdAt, lastDayOfWeek))
    )

     // Cria um CTE para filtrar as metas completadas na semana
     const goalsCompletedInWeek = db.$with('goals_completed_in_week').as(
        db.select({
            id: goalCompletions.id,
            title: goals.title,
            completedAt: goalCompletions.createdAt,
            completedAtDate: sql /*sql */`
                DATE(${goalCompletions.createdAt})
            `.as('completedAtDate ')
        })
         .from(goalCompletions)
         .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
         .where(
                and(
            gte(goalCompletions.createdAt, firstDayOfWeek),
            lte(goalCompletions.createdAt, lastDayOfWeek)
         ))
    )

     // Cria um CTE para filtrar as metas completadas na semana
         const goalsCompledByWeekDay = db.$with('goals_completed_by_week_day').as(

            db
            .select({
                completedAtDate: goalsCompletedInWeek.completedAtDate,
                completions: sql /*sql */`
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', ${goalsCompletedInWeek.id},
                            'title', ${goalsCompletedInWeek.title},
                            'completedAt', ${goalsCompletedInWeek.completedAt}
                        )
                    )
                
                `.as('completions')
            })
            .from(goalsCompletedInWeek)
            .groupBy(goalsCompletedInWeek.completedAtDate)
        )

    const result = await db
    .with(goalsCreatedUpToWeek, goalsCompletedInWeek, goalsCompledByWeekDay)
    .select({
        completed: 
            sql /*sql*/`
            (SELECT COUNT(*) FROM ${goalsCompletedInWeek})
            `.mapWith(Number),

            total: sql /*sql*/`(SELECT SUM(${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})`.mapWith(
                Number
             ),
            
        goalsPerDay: sql /*sql*/`
            ${goalsCompledByWeekDay.completedAtDate}
            ${goalsCompledByWeekDay.completions}
        `
    })
    .from(goalsCompledByWeekDay)


    return {
        summary: result,
    }
}