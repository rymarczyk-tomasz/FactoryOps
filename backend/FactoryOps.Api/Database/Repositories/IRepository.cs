using FactoryOps.Api.Database.Models;

namespace FactoryOps.Api.Database.Repositories;

public interface IRepository<T> where T : BaseEntity
{
	Task<T?> Get(int id);
	IAsyncEnumerable<T> GetAll();
	IQueryable<T> GetAllQueryable();
	Task Insert(T entity);
	Task Update(T entity);
	Task Delete(T entity);
}
