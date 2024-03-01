using Microsoft.AspNetCore.Mvc;
using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("items")]
public class WorkItemsController(IRepository<Item> itemsRepository) : ControllerBase
{
	[HttpGet]
	public ActionResult<IAsyncEnumerable<Item>> GetAll() => Ok(itemsRepository.GetAll());
	
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Item>> Get(int id) => Ok(await itemsRepository.Get(id));

	[HttpPost]
	[Route("insertOrUpdate")]
	public async Task<IActionResult> InsertOrUpdate([FromBody] Item workItem)
	{
		await itemsRepository.InsertOrUpdate(workItem);
		return Ok();
	}

	[HttpDelete]
	[Route("delete")]
	public async Task<IActionResult> Delete([FromBody] Item item)
	{
		await itemsRepository.Delete(item);
		return Ok();
	}
}
