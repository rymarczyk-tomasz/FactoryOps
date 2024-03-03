using FactoryOps.Api.Database.Contexts;
using FactoryOps.Api.Database.Models;
using Microsoft.EntityFrameworkCore;

namespace FactoryOps.Api.Database.Repositories;
public class Repository<T> : IRepository<T> where T : BaseEntity
{
	private readonly FactoryOpsContext context;
	private readonly DbSet<T> entities;

	public Repository(FactoryOpsContext context)
	{
		this.context = context;
		this.entities = this.context.Set<T>();
	}

	public async Task<T?> Get(int id) => await this.entities.SingleOrDefaultAsync(s => s.Id == id);

	public IQueryable<T> GetAll() => this.entities.AsQueryable();

	public async Task<T?> InsertOrUpdate(T entity)
	{
		ArgumentNullException.ThrowIfNull(entity);

		this.context.Entry(entity).State = entity.Id == 0 ? EntityState.Added : EntityState.Modified;
		await this.context.SaveChangesAsync();
		return this.context.Entry(entity).Entity;
	}

	public async Task Delete(T entity)
	{
		ArgumentNullException.ThrowIfNull(entity);

		this.entities.Remove(entity);
		await this.context.SaveChangesAsync();
	}
}
