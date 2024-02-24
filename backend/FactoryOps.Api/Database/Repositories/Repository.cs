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

	public IAsyncEnumerable<T> GetAll() => this.entities.AsAsyncEnumerable();

	public IQueryable<T> GetAllQueryable() => this.entities.AsQueryable();

	public async Task Insert(T entity)
	{
		ArgumentNullException.ThrowIfNull(entity);

		this.entities.Add(entity);
		await this.context.SaveChangesAsync();
	}

	public async Task Update(T entity)
	{
		ArgumentNullException.ThrowIfNull(entity);
		this.context.Update(entity);
		await this.context.SaveChangesAsync();
	}

	public async Task Delete(T entity)
	{
		ArgumentNullException.ThrowIfNull(entity);

		this.entities.Remove(entity);
		await this.context.SaveChangesAsync();
	}
}
